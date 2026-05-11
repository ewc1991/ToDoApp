import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import {
  doc, collection,
  setDoc, updateDoc, deleteDoc, writeBatch, arrayUnion, getDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { today } from '../utils/dateUtils';
import { shouldRecurOnDate } from '../utils/recurringUtils';

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const ts = () => new Date().toISOString();

const now = new Date();

const INITIAL_STATE = {
  tasks: [],
  scheduledBlocks: [],
  recurringTemplates: [],
  generatedDates: [],
  currentPage: 'calendar',
  currentPlannerDate: null,
  calendarMonth: now.getMonth(),
  calendarYear: now.getFullYear(),
  lastVisitDate: today(),
  lastCompletedTask: null,
  showCompletedTasks: false,
  showCompletedBlocks: false,
};

// Merge settings from Firestore into current state, preserving client-only navigation state
function applySettings(state, settings) {
  const todayStr = today();
  const merged = { ...state, ...settings };
  if (merged.lastVisitDate !== todayStr) {
    return { ...merged, currentPlannerDate: null, lastVisitDate: todayStr, lastCompletedTask: null };
  }
  return merged;
}

function reducer(state, action) {
  switch (action.type) {

    // ── Firestore load actions ─────────────────────────────
    case 'RESET':
      return INITIAL_STATE;

    case 'SET_TASKS': {
      const sorted = [...action.tasks].sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
      return { ...state, tasks: sorted };
    }

    case 'SET_SCHEDULED_BLOCKS':
      return { ...state, scheduledBlocks: action.scheduledBlocks };

    case 'SET_RECURRING_TEMPLATES':
      return { ...state, recurringTemplates: action.recurringTemplates };

    case 'SET_SETTINGS':
      return applySettings(state, action.settings);

    // ── Tasks ───────────────────────────────────────────────
    case 'ADD_TASK':
      return { ...state, tasks: [...state.tasks, action.task] };

    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map(t => t.id === action.id ? { ...t, ...action.updates, updatedAt: ts() } : t),
      };

    case 'DELETE_TASK':
      return {
        ...state,
        tasks: state.tasks.filter(t => t.id !== action.id),
        scheduledBlocks: state.scheduledBlocks.filter(b => b.todoTaskId !== action.id),
      };

    case 'TOGGLE_TASK_COMPLETE': {
      const task = state.tasks.find(t => t.id === action.id);
      if (!task) return state;
      const completed = !task.completed;
      return {
        ...state,
        tasks: state.tasks.map(t => t.id === action.id ? { ...t, completed, updatedAt: ts() } : t),
        scheduledBlocks: state.scheduledBlocks.map(b =>
          b.todoTaskId === action.id ? { ...b, completed, updatedAt: ts() } : b
        ),
        lastCompletedTask: completed ? { ...task, completed } : state.lastCompletedTask,
      };
    }

    case 'UNDO_LAST_COMPLETION': {
      const { lastCompletedTask } = state;
      if (!lastCompletedTask) return state;
      return {
        ...state,
        tasks: state.tasks.map(t => t.id === lastCompletedTask.id ? { ...t, completed: false, updatedAt: ts() } : t),
        scheduledBlocks: state.scheduledBlocks.map(b =>
          b.todoTaskId === lastCompletedTask.id ? { ...b, completed: false, updatedAt: ts() } : b
        ),
        lastCompletedTask: null,
      };
    }

    case 'REORDER_TASKS': {
      const { orderedIds } = action;
      const taskMap = Object.fromEntries(state.tasks.map(t => [t.id, t]));
      const positions = orderedIds
        .map(id => state.tasks.findIndex(t => t.id === id))
        .filter(i => i !== -1)
        .sort((a, b) => a - b);
      const newTasks = [...state.tasks];
      orderedIds.forEach((id, i) => { newTasks[positions[i]] = { ...taskMap[id], sortIndex: i }; });
      return { ...state, tasks: newTasks };
    }

    // ── Scheduled blocks ────────────────────────────────────
    case 'ADD_SCHEDULED_BLOCK':
      return { ...state, scheduledBlocks: [...state.scheduledBlocks, action.block] };

    case 'UPDATE_SCHEDULED_BLOCK':
      return {
        ...state,
        scheduledBlocks: state.scheduledBlocks.map(b =>
          b.id === action.id ? { ...b, ...action.updates, updatedAt: ts() } : b
        ),
      };

    case 'DELETE_SCHEDULED_BLOCK':
      return { ...state, scheduledBlocks: state.scheduledBlocks.filter(b => b.id !== action.id) };

    case 'TOGGLE_BLOCK_COMPLETE': {
      const block = state.scheduledBlocks.find(b => b.id === action.id);
      if (!block) return state;
      const completed = !block.completed;
      return {
        ...state,
        scheduledBlocks: state.scheduledBlocks.map(b => b.id === action.id ? { ...b, completed, updatedAt: ts() } : b),
        tasks: block.todoTaskId
          ? state.tasks.map(t => t.id === block.todoTaskId ? { ...t, completed, updatedAt: ts() } : t)
          : state.tasks,
        lastCompletedTask: completed && block.todoTaskId
          ? state.tasks.find(t => t.id === block.todoTaskId) || state.lastCompletedTask
          : state.lastCompletedTask,
      };
    }

    // ── Recurring templates ─────────────────────────────────
    case 'ADD_RECURRING_TEMPLATE':
      return { ...state, recurringTemplates: [...state.recurringTemplates, action.template] };

    case 'UPDATE_RECURRING_TEMPLATE':
      return {
        ...state,
        recurringTemplates: state.recurringTemplates.map(t =>
          t.id === action.id ? { ...t, ...action.updates, updatedAt: ts() } : t
        ),
      };

    case 'DELETE_RECURRING_TEMPLATE':
      return { ...state, recurringTemplates: state.recurringTemplates.filter(t => t.id !== action.id) };

    case 'GENERATE_RECURRING_FOR_DATE': {
      if (state.generatedDates.includes(action.dateStr)) return state;
      return {
        ...state,
        tasks: [...state.tasks, ...action.newTasks],
        generatedDates: [...state.generatedDates, action.dateStr],
      };
    }

    // ── Navigation ──────────────────────────────────────────
    case 'NAVIGATE_PAGE':
      return { ...state, currentPage: action.page };

    case 'NAVIGATE_DATE':
      return { ...state, currentPlannerDate: action.dateStr, currentPage: 'calendar', lastVisitDate: today() };

    case 'NAVIGATE_CALENDAR':
      return { ...state, currentPlannerDate: null };

    case 'NAVIGATE_MONTH': {
      let { calendarMonth: m, calendarYear: y } = state;
      if (action.dir === 'prev') { m--; if (m < 0) { m = 11; y--; } }
      else { m++; if (m > 11) { m = 0; y++; } }
      return { ...state, calendarMonth: m, calendarYear: y };
    }

    case 'SET_MONTH_YEAR':
      return { ...state, calendarMonth: action.month, calendarYear: action.year };

    case 'TOGGLE_SHOW_COMPLETED_TASKS':
      return { ...state, showCompletedTasks: !state.showCompletedTasks };

    case 'TOGGLE_SHOW_COMPLETED_BLOCKS':
      return { ...state, showCompletedBlocks: !state.showCompletedBlocks };

    case 'ROLLOVER_TASKS': {
      const idSet = new Set(action.taskIds);
      return {
        ...state,
        tasks: state.tasks.map(t =>
          idSet.has(t.id) ? { ...t, assignedDate: action.toDate, updatedAt: ts() } : t
        ),
      };
    }

    default:
      return state;
  }
}

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, baseDispatch] = useReducer(reducer, INITIAL_STATE);
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const stateRef = useRef(state);
  const settingsReadyRef = useRef(false);

  useEffect(() => { stateRef.current = state; }, [state]);

  // Dispatch wrapper — updates local state AND writes the targeted Firestore doc(s)
  const dispatch = useCallback((action) => {
    const s = stateRef.current;
    let enriched = action;

    switch (action.type) {

      case 'ADD_TASK': {
        const task = {
          id: genId(), title: action.title, notes: action.notes || '',
          completed: false, assignedDate: action.assignedDate || null,
          recurringTemplateId: action.recurringTemplateId || null,
          sortIndex: s.tasks.length,
          createdAt: ts(), updatedAt: ts(),
        };
        enriched = { ...action, task };
        if (uid) setDoc(doc(db, 'users', uid, 'tasks', task.id), task).catch(console.error);
        break;
      }

      case 'UPDATE_TASK': {
        const updates = { ...action.updates, updatedAt: ts() };
        enriched = { ...action, updates };
        if (uid) updateDoc(doc(db, 'users', uid, 'tasks', action.id), updates).catch(console.error);
        break;
      }

      case 'DELETE_TASK': {
        if (uid) {
          deleteDoc(doc(db, 'users', uid, 'tasks', action.id)).catch(console.error);
          s.scheduledBlocks
            .filter(b => b.todoTaskId === action.id)
            .forEach(b => deleteDoc(doc(db, 'users', uid, 'scheduledBlocks', b.id)).catch(console.error));
        }
        break;
      }

      case 'TOGGLE_TASK_COMPLETE': {
        const task = s.tasks.find(t => t.id === action.id);
        if (!task || !uid) break;
        const completed = !task.completed;
        const updates = { completed, updatedAt: ts() };
        updateDoc(doc(db, 'users', uid, 'tasks', action.id), updates).catch(console.error);
        s.scheduledBlocks
          .filter(b => b.todoTaskId === action.id)
          .forEach(b => updateDoc(doc(db, 'users', uid, 'scheduledBlocks', b.id), updates).catch(console.error));
        setDoc(doc(db, 'users', uid, 'settings', 'data'),
          { lastCompletedTask: completed ? { ...task, completed } : null },
          { merge: true }).catch(console.error);
        break;
      }

      case 'UNDO_LAST_COMPLETION': {
        const { lastCompletedTask } = s;
        if (!lastCompletedTask || !uid) break;
        const updates = { completed: false, updatedAt: ts() };
        updateDoc(doc(db, 'users', uid, 'tasks', lastCompletedTask.id), updates).catch(console.error);
        s.scheduledBlocks
          .filter(b => b.todoTaskId === lastCompletedTask.id)
          .forEach(b => updateDoc(doc(db, 'users', uid, 'scheduledBlocks', b.id), updates).catch(console.error));
        setDoc(doc(db, 'users', uid, 'settings', 'data'), { lastCompletedTask: null }, { merge: true }).catch(console.error);
        break;
      }

      case 'REORDER_TASKS': {
        if (uid && action.orderedIds) {
          const batch = writeBatch(db);
          action.orderedIds.forEach((id, i) => {
            batch.update(doc(db, 'users', uid, 'tasks', id), { sortIndex: i, updatedAt: ts() });
          });
          batch.commit().catch(console.error);
        }
        break;
      }

      case 'ADD_SCHEDULED_BLOCK': {
        const block = {
          id: genId(), title: action.title, notes: action.notes || '',
          completed: false, date: action.date,
          startTime: action.startTime, endTime: action.endTime,
          todoTaskId: action.todoTaskId || null,
          createdAt: ts(), updatedAt: ts(),
        };
        enriched = { ...action, block };
        if (uid) setDoc(doc(db, 'users', uid, 'scheduledBlocks', block.id), block).catch(console.error);
        break;
      }

      case 'UPDATE_SCHEDULED_BLOCK': {
        const updates = { ...action.updates, updatedAt: ts() };
        enriched = { ...action, updates };
        if (uid) updateDoc(doc(db, 'users', uid, 'scheduledBlocks', action.id), updates).catch(console.error);
        break;
      }

      case 'DELETE_SCHEDULED_BLOCK': {
        if (uid) deleteDoc(doc(db, 'users', uid, 'scheduledBlocks', action.id)).catch(console.error);
        break;
      }

      case 'TOGGLE_BLOCK_COMPLETE': {
        const block = s.scheduledBlocks.find(b => b.id === action.id);
        if (!block || !uid) break;
        const completed = !block.completed;
        const updates = { completed, updatedAt: ts() };
        updateDoc(doc(db, 'users', uid, 'scheduledBlocks', block.id), updates).catch(console.error);
        if (block.todoTaskId) {
          updateDoc(doc(db, 'users', uid, 'tasks', block.todoTaskId), updates).catch(console.error);
          if (completed) {
            const linkedTask = s.tasks.find(t => t.id === block.todoTaskId);
            if (linkedTask) {
              setDoc(doc(db, 'users', uid, 'settings', 'data'),
                { lastCompletedTask: { ...linkedTask, completed } },
                { merge: true }).catch(console.error);
            }
          }
        }
        break;
      }

      case 'ADD_RECURRING_TEMPLATE': {
        const template = {
          id: genId(), title: action.title, notes: action.notes || '',
          recurrenceType: action.recurrenceType,
          dayOfWeek:             action.dayOfWeek             ?? null,
          dayOfMonth:            action.dayOfMonth            ?? null,
          monthlyMode:           action.monthlyMode           ?? null,
          monthlyWeekOccurrence: action.monthlyWeekOccurrence ?? null,
          customInterval:        action.customInterval        ?? null,
          customUnit:            action.customUnit            ?? null,
          startDate: action.startDate || null, endDate: action.endDate || null,
          createdAt: ts(), updatedAt: ts(),
        };
        enriched = { ...action, template };
        if (uid) setDoc(doc(db, 'users', uid, 'recurringTemplates', template.id), template).catch(console.error);
        break;
      }

      case 'UPDATE_RECURRING_TEMPLATE': {
        const updates = { ...action.updates, updatedAt: ts() };
        enriched = { ...action, updates };
        if (uid) updateDoc(doc(db, 'users', uid, 'recurringTemplates', action.id), updates).catch(console.error);
        break;
      }

      case 'DELETE_RECURRING_TEMPLATE': {
        if (uid) deleteDoc(doc(db, 'users', uid, 'recurringTemplates', action.id)).catch(console.error);
        break;
      }

      case 'GENERATE_RECURRING_FOR_DATE': {
        if (s.generatedDates.includes(action.dateStr)) return; // skip entirely
        const newTasks = s.recurringTemplates
          .filter(tmpl => shouldRecurOnDate(tmpl, action.dateStr))
          .map((tmpl, i) => ({
            id: genId(), title: tmpl.title, notes: tmpl.notes, completed: false,
            assignedDate: action.dateStr, recurringTemplateId: tmpl.id,
            sortIndex: s.tasks.length + i,
            createdAt: ts(), updatedAt: ts(),
          }));
        enriched = { ...action, newTasks };
        if (uid) {
          newTasks.forEach(task =>
            setDoc(doc(db, 'users', uid, 'tasks', task.id), task).catch(console.error)
          );
          // Use arrayUnion so this is atomic and idempotent
          setDoc(doc(db, 'users', uid, 'settings', 'data'),
            { generatedDates: arrayUnion(action.dateStr) },
            { merge: true }).catch(console.error);
        }
        break;
      }
    }

    baseDispatch(enriched);
  }, [uid]);

  // Subscribe to Firestore collections; migrate old plannerState doc if present
  useEffect(() => {
    if (!uid) {
      settingsReadyRef.current = false;
      baseDispatch({ type: 'RESET' });
      return;
    }

    settingsReadyRef.current = false;
    let cancelled = false;
    let unsubs = [];

    const init = async () => {
      // One-time migration from old single-document format
      const oldSnap = await getDoc(doc(db, 'users', uid, 'data', 'plannerState'));
      if (cancelled) return;

      if (oldSnap.exists()) {
        const old = oldSnap.data();
        const batch = writeBatch(db);
        (old.tasks || []).forEach((t, i) =>
          batch.set(doc(db, 'users', uid, 'tasks', t.id), { ...t, sortIndex: i })
        );
        (old.scheduledBlocks || []).forEach(b =>
          batch.set(doc(db, 'users', uid, 'scheduledBlocks', b.id), b)
        );
        (old.recurringTemplates || []).forEach(t =>
          batch.set(doc(db, 'users', uid, 'recurringTemplates', t.id), t)
        );
        batch.set(doc(db, 'users', uid, 'settings', 'data'), {
          generatedDates: old.generatedDates || [],
          calendarMonth: old.calendarMonth ?? now.getMonth(),
          calendarYear: old.calendarYear ?? now.getFullYear(),
          lastVisitDate: old.lastVisitDate ?? today(),
          showCompletedTasks: old.showCompletedTasks ?? false,
          showCompletedBlocks: old.showCompletedBlocks ?? false,
          lastCompletedTask: old.lastCompletedTask ?? null,
        });
        batch.delete(doc(db, 'users', uid, 'data', 'plannerState'));
        await batch.commit();
        if (cancelled) return;
      }

      // Rollover coordination: wait for settings + tasks + templates first-fire
      const ROLLOVER_TYPES = new Set(['weekly', 'biweekly', 'monthly']);
      let settingsFirstFired = false;
      let tasksFirstFired = false;
      let templatesFirstFired = false;
      let shouldRollover = false;
      let cachedTasks = [];
      let cachedTemplates = [];

      const tryRollover = () => {
        if (!settingsFirstFired || !tasksFirstFired || !templatesFirstFired || !shouldRollover) return;
        shouldRollover = false;
        const todayStr = today();
        const templateMap = Object.fromEntries(cachedTemplates.map(t => [t.id, t]));
        const tasksToRoll = cachedTasks.filter(t => {
          if (!t.assignedDate || t.assignedDate >= todayStr || t.completed) return false;
          if (!t.recurringTemplateId) return true;
          const tmpl = templateMap[t.recurringTemplateId];
          return tmpl && ROLLOVER_TYPES.has(tmpl.recurrenceType);
        });
        if (tasksToRoll.length === 0) return;
        const nowTs = ts();
        const batch = writeBatch(db);
        tasksToRoll.forEach(t => {
          batch.update(doc(db, 'users', uid, 'tasks', t.id), { assignedDate: todayStr, updatedAt: nowTs });
        });
        batch.commit().catch(console.error);
        baseDispatch({ type: 'ROLLOVER_TASKS', taskIds: tasksToRoll.map(t => t.id), toDate: todayStr });
      };

      // Real-time listeners for all three data collections
      unsubs = [
        onSnapshot(collection(db, 'users', uid, 'tasks'), snap => {
          if (cancelled) return;
          cachedTasks = snap.docs.map(d => d.data());
          baseDispatch({ type: 'SET_TASKS', tasks: cachedTasks });
          if (!tasksFirstFired) { tasksFirstFired = true; tryRollover(); }
        }),
        onSnapshot(collection(db, 'users', uid, 'scheduledBlocks'), snap => {
          if (!cancelled)
            baseDispatch({ type: 'SET_SCHEDULED_BLOCKS', scheduledBlocks: snap.docs.map(d => d.data()) });
        }),
        onSnapshot(collection(db, 'users', uid, 'recurringTemplates'), snap => {
          if (cancelled) return;
          cachedTemplates = snap.docs.map(d => d.data());
          baseDispatch({ type: 'SET_RECURRING_TEMPLATES', recurringTemplates: cachedTemplates });
          if (!templatesFirstFired) { templatesFirstFired = true; tryRollover(); }
        }),
        onSnapshot(doc(db, 'users', uid, 'settings', 'data'), snap => {
          if (cancelled) return;
          if (snap.exists()) {
            const settings = snap.data();
            if (!settingsFirstFired && settings.lastVisitDate && settings.lastVisitDate !== today()) {
              shouldRollover = true;
            }
            baseDispatch({ type: 'SET_SETTINGS', settings });
          }
          if (!settingsFirstFired) {
            settingsFirstFired = true;
            settingsReadyRef.current = true;
            tryRollover();
          } else {
            settingsReadyRef.current = true;
          }
        }),
      ];
    };

    init().catch(console.error);

    return () => {
      cancelled = true;
      unsubs.forEach(u => u());
    };
  }, [uid]);

  // Debounced save of navigation/UI settings (not covered by per-action writes)
  useEffect(() => {
    if (!uid || !settingsReadyRef.current) return;
    const timer = setTimeout(() => {
      setDoc(doc(db, 'users', uid, 'settings', 'data'), {
        calendarMonth: state.calendarMonth,
        calendarYear: state.calendarYear,
        lastVisitDate: state.lastVisitDate,
        showCompletedTasks: state.showCompletedTasks,
        showCompletedBlocks: state.showCompletedBlocks,
        lastCompletedTask: state.lastCompletedTask,
        currentPlannerDate: state.currentPlannerDate,
      }, { merge: true }).catch(console.error);
    }, 1000);
    return () => clearTimeout(timer);
  }, [
    uid,
    state.calendarMonth,
    state.calendarYear,
    state.lastVisitDate,
    state.showCompletedTasks,
    state.showCompletedBlocks,
    state.lastCompletedTask,
    state.currentPlannerDate,
  ]);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
