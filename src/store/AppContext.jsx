import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef, useState } from 'react';
import {
  doc, collection,
  setDoc, updateDoc, deleteDoc, writeBatch, arrayUnion, getDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { today, formatDate } from '../utils/dateUtils';
import { shouldRecurOnDate } from '../utils/recurringUtils';

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const ts = () => new Date().toISOString();

const now = new Date();

// Recurrence types whose incomplete instances roll forward to today.
// daily/weekdays/weekends deliberately don't roll — a missed day is just missed.
const ROLLOVER_TYPES = new Set(['weekly', 'biweekly', 'monthly']);
// Non-rolling recurring instances are deleted once older than this, so they
// don't accumulate in Firestore (and in memory) forever.
const STALE_RECURRING_DAYS = 14;

const dateDaysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatDate(d);
};

// Next sortIndex that can't collide with an existing one.
// (tasks.length collides as soon as anything has been deleted.)
const nextSortIndex = (tasks) =>
  tasks.reduce((max, t) => Math.max(max, t.sortIndex ?? -1), -1) + 1;

const INITIAL_STATE = {
  tasks: [],
  scheduledBlocks: [],
  recurringTemplates: [],
  notes: [],
  recurringTemplatesLoaded: false,
  generatedDates: [],
  currentPage: 'calendar',
  currentPlannerDate: null,
  calendarMonth: now.getMonth(),
  calendarYear: now.getFullYear(),
  lastVisitDate: today(),
  lastCompletedTask: null,
  showCompletedTasks: false,
};

// Merge settings from Firestore into current state, preserving client-only navigation state.
// `hydrate` is true only for the first snapshot after sign-in.
function applySettings(state, settings, hydrate) {
  const todayStr = today();
  const { currentPlannerDate: incomingDate, ...rest } = settings;
  const merged = { ...state, ...rest };
  if (merged.lastVisitDate !== todayStr) {
    return { ...merged, currentPlannerDate: null, lastVisitDate: todayStr, lastCompletedTask: null };
  }
  // Which day you're viewing is restored once on load, then owned entirely by the client.
  // Any later echo would be stale: writes like TOGGLE_TASK_COMPLETE merge into the same
  // settings doc, so their snapshots still carry the old date and would otherwise bounce
  // the user back into a day view they had already left.
  if (hydrate && incomingDate !== undefined) merged.currentPlannerDate = incomingDate;
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
      return { ...state, recurringTemplates: action.recurringTemplates, recurringTemplatesLoaded: true };

    case 'SET_NOTES':
      return { ...state, notes: action.notes };

    case 'ADD_NOTE':
      return { ...state, notes: [action.note, ...state.notes] };

    case 'UPDATE_NOTE':
      return {
        ...state,
        notes: state.notes.map(n => n.id === action.id ? { ...n, ...action.updates, updatedAt: ts() } : n),
      };

    case 'DELETE_NOTE':
      return { ...state, notes: state.notes.filter(n => n.id !== action.id) };

    case 'SET_SETTINGS':
      return applySettings(state, action.settings, action.hydrate);

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
      // Use positions[i] as sortIndex so tasks outside orderedIds keep their existing
      // sortIndex values without collisions.
      orderedIds.forEach((id, i) => { newTasks[positions[i]] = { ...taskMap[id], sortIndex: positions[i] }; });
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
      return {
        ...state,
        recurringTemplates: state.recurringTemplates.filter(t => t.id !== action.id),
        tasks: state.tasks.filter(t => t.recurringTemplateId !== action.id),
      };

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
      return {
        ...state,
        currentPage: action.page,
        currentPlannerDate: (action.page === 'calendar' && state.currentPage === 'calendar')
          ? null
          : state.currentPlannerDate,
      };

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

    case 'DAY_TRANSITION': {
      const rolled = new Set(action.rolledIds);
      const pruned = new Set(action.prunedIds);
      return {
        ...state,
        tasks: state.tasks
          .filter(t => !pruned.has(t.id))
          .map(t => rolled.has(t.id) ? { ...t, assignedDate: action.toDate, updatedAt: ts() } : t),
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
  const cachedTasksRef = useRef([]);
  const cachedTemplatesRef = useRef([]);
  const lastTransitionDateRef = useRef(today());
  const [networkError, setNetworkError] = useState(null);
  const networkErrorTimerRef = useRef(null);
  const handleErrRef = useRef((e) => {
    console.error(e);
    setNetworkError('Failed to save. Check your connection.');
    clearTimeout(networkErrorTimerRef.current);
    networkErrorTimerRef.current = setTimeout(() => setNetworkError(null), 5000);
  });

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
          sortIndex: nextSortIndex(s.tasks),
          createdAt: ts(), updatedAt: ts(),
        };
        enriched = { ...action, task };
        if (uid) setDoc(doc(db, 'users', uid, 'tasks', task.id), task).catch(handleErrRef.current);
        break;
      }

      case 'UPDATE_TASK': {
        const updates = { ...action.updates, updatedAt: ts() };
        enriched = { ...action, updates };
        if (uid) updateDoc(doc(db, 'users', uid, 'tasks', action.id), updates).catch(handleErrRef.current);
        break;
      }

      case 'DELETE_TASK': {
        if (uid) {
          deleteDoc(doc(db, 'users', uid, 'tasks', action.id)).catch(handleErrRef.current);
          s.scheduledBlocks
            .filter(b => b.todoTaskId === action.id)
            .forEach(b => deleteDoc(doc(db, 'users', uid, 'scheduledBlocks', b.id)).catch(handleErrRef.current));
        }
        break;
      }

      case 'TOGGLE_TASK_COMPLETE': {
        const task = s.tasks.find(t => t.id === action.id);
        if (!task || !uid) break;
        const completed = !task.completed;
        const updates = { completed, updatedAt: ts() };
        updateDoc(doc(db, 'users', uid, 'tasks', action.id), updates).catch(handleErrRef.current);
        s.scheduledBlocks
          .filter(b => b.todoTaskId === action.id)
          .forEach(b => updateDoc(doc(db, 'users', uid, 'scheduledBlocks', b.id), updates).catch(handleErrRef.current));
        setDoc(doc(db, 'users', uid, 'settings', 'data'),
          { lastCompletedTask: completed ? { ...task, completed } : null },
          { merge: true }).catch(handleErrRef.current);
        break;
      }

      case 'UNDO_LAST_COMPLETION': {
        const { lastCompletedTask } = s;
        if (!lastCompletedTask || !uid) break;
        const updates = { completed: false, updatedAt: ts() };
        updateDoc(doc(db, 'users', uid, 'tasks', lastCompletedTask.id), updates).catch(handleErrRef.current);
        s.scheduledBlocks
          .filter(b => b.todoTaskId === lastCompletedTask.id)
          .forEach(b => updateDoc(doc(db, 'users', uid, 'scheduledBlocks', b.id), updates).catch(handleErrRef.current));
        setDoc(doc(db, 'users', uid, 'settings', 'data'), { lastCompletedTask: null }, { merge: true }).catch(handleErrRef.current);
        break;
      }

      case 'REORDER_TASKS': {
        if (uid && action.orderedIds) {
          const positions = action.orderedIds
            .map(id => s.tasks.findIndex(t => t.id === id))
            .filter(i => i !== -1)
            .sort((a, b) => a - b);
          const batch = writeBatch(db);
          action.orderedIds.forEach((id, i) => {
            batch.update(doc(db, 'users', uid, 'tasks', id), { sortIndex: positions[i], updatedAt: ts() });
          });
          batch.commit().catch(handleErrRef.current);
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
        if (uid) setDoc(doc(db, 'users', uid, 'scheduledBlocks', block.id), block).catch(handleErrRef.current);
        break;
      }

      case 'UPDATE_SCHEDULED_BLOCK': {
        const updates = { ...action.updates, updatedAt: ts() };
        enriched = { ...action, updates };
        if (uid) updateDoc(doc(db, 'users', uid, 'scheduledBlocks', action.id), updates).catch(handleErrRef.current);
        break;
      }

      case 'DELETE_SCHEDULED_BLOCK': {
        if (uid) deleteDoc(doc(db, 'users', uid, 'scheduledBlocks', action.id)).catch(handleErrRef.current);
        break;
      }

      case 'TOGGLE_BLOCK_COMPLETE': {
        const block = s.scheduledBlocks.find(b => b.id === action.id);
        if (!block || !uid) break;
        const completed = !block.completed;
        const updates = { completed, updatedAt: ts() };
        updateDoc(doc(db, 'users', uid, 'scheduledBlocks', block.id), updates).catch(handleErrRef.current);
        if (block.todoTaskId) {
          updateDoc(doc(db, 'users', uid, 'tasks', block.todoTaskId), updates).catch(handleErrRef.current);
          if (completed) {
            const linkedTask = s.tasks.find(t => t.id === block.todoTaskId);
            if (linkedTask) {
              setDoc(doc(db, 'users', uid, 'settings', 'data'),
                { lastCompletedTask: { ...linkedTask, completed } },
                { merge: true }).catch(handleErrRef.current);
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
        if (uid) setDoc(doc(db, 'users', uid, 'recurringTemplates', template.id), template).catch(handleErrRef.current);
        break;
      }

      case 'UPDATE_RECURRING_TEMPLATE': {
        const updates = { ...action.updates, updatedAt: ts() };
        enriched = { ...action, updates };
        if (uid) updateDoc(doc(db, 'users', uid, 'recurringTemplates', action.id), updates).catch(handleErrRef.current);
        break;
      }

      case 'DELETE_RECURRING_TEMPLATE': {
        if (uid) {
          deleteDoc(doc(db, 'users', uid, 'recurringTemplates', action.id)).catch(handleErrRef.current);
          s.tasks
            .filter(t => t.recurringTemplateId === action.id)
            .forEach(t => deleteDoc(doc(db, 'users', uid, 'tasks', t.id)).catch(handleErrRef.current));
        }
        break;
      }

      case 'ADD_NOTE': {
        const note = {
          id: genId(), body: action.body || '',
          createdAt: ts(), updatedAt: ts(),
        };
        enriched = { ...action, note };
        if (uid) setDoc(doc(db, 'users', uid, 'notes', note.id), note).catch(handleErrRef.current);
        break;
      }

      case 'UPDATE_NOTE': {
        const updates = { ...action.updates, updatedAt: ts() };
        enriched = { ...action, updates };
        if (uid) updateDoc(doc(db, 'users', uid, 'notes', action.id), updates).catch(handleErrRef.current);
        break;
      }

      case 'DELETE_NOTE': {
        if (uid) deleteDoc(doc(db, 'users', uid, 'notes', action.id)).catch(handleErrRef.current);
        break;
      }

      case 'GENERATE_RECURRING_FOR_DATE': {
        if (s.generatedDates.includes(action.dateStr)) break; // reducer also guards; skip Firestore write
        const base = nextSortIndex(s.tasks);
        const newTasks = s.recurringTemplates
          .filter(tmpl => shouldRecurOnDate(tmpl, action.dateStr))
          .map((tmpl, i) => ({
            id: genId(), title: tmpl.title, notes: tmpl.notes, completed: false,
            assignedDate: action.dateStr, recurringTemplateId: tmpl.id,
            sortIndex: base + i,
            createdAt: ts(), updatedAt: ts(),
          }));
        enriched = { ...action, newTasks };
        if (uid) {
          newTasks.forEach(task =>
            setDoc(doc(db, 'users', uid, 'tasks', task.id), task).catch(handleErrRef.current)
          );
          // Use arrayUnion so this is atomic and idempotent
          setDoc(doc(db, 'users', uid, 'settings', 'data'),
            { generatedDates: arrayUnion(action.dateStr) },
            { merge: true }).catch(handleErrRef.current);
        }
        break;
      }
    }

    baseDispatch(enriched);
  }, [uid]);

  // Roll incomplete dated tasks forward to today, and prune stale non-rolling
  // recurring instances. Safe to call repeatedly — it no-ops when there's nothing to do.
  const runDayTransition = useCallback((tasks, templates) => {
    if (!uid) return;
    const todayStr = today();
    const templateMap = Object.fromEntries(templates.map(t => [t.id, t]));
    const cutoff = dateDaysAgo(STALE_RECURRING_DAYS);

    const toRoll = [];
    const toPrune = [];
    tasks.forEach(t => {
      if (!t.assignedDate || t.assignedDate >= todayStr || t.completed) return;
      if (!t.recurringTemplateId) { toRoll.push(t); return; }
      const tmpl = templateMap[t.recurringTemplateId];
      // No template means either an orphan or templates haven't loaded yet — leave it alone
      // rather than risk deleting live data.
      if (!tmpl) return;
      if (ROLLOVER_TYPES.has(tmpl.recurrenceType)) { toRoll.push(t); return; }
      if (t.assignedDate < cutoff) toPrune.push(t);
    });

    if (toRoll.length === 0 && toPrune.length === 0) return;

    const nowTs = ts();
    const batch = writeBatch(db);
    toRoll.forEach(t =>
      batch.update(doc(db, 'users', uid, 'tasks', t.id), { assignedDate: todayStr, updatedAt: nowTs })
    );
    toPrune.forEach(t => batch.delete(doc(db, 'users', uid, 'tasks', t.id)));
    batch.commit().catch(handleErrRef.current);

    baseDispatch({
      type: 'DAY_TRANSITION',
      rolledIds: toRoll.map(t => t.id),
      prunedIds: toPrune.map(t => t.id),
      toDate: todayStr,
    });
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
          lastCompletedTask: old.lastCompletedTask ?? null,
        });
        batch.delete(doc(db, 'users', uid, 'data', 'plannerState'));
        await batch.commit();
        if (cancelled) return;
      }

      // Rollover coordination: wait for settings + tasks + templates first-fire
      let settingsFirstFired = false;
      let tasksFirstFired = false;
      let templatesFirstFired = false;
      let cachedTasks = [];
      let cachedTemplates = [];

      const tryRollover = () => {
        if (!settingsFirstFired || !tasksFirstFired || !templatesFirstFired) return;
        lastTransitionDateRef.current = today();
        runDayTransition(cachedTasks, cachedTemplates);
      };

      // A read failure (expired token, revoked permission, quota) otherwise surfaces as an
      // unhandled rejection and the UI just silently stops updating.
      const onReadError = (e) => {
        if (!cancelled) handleErrRef.current(e);
      };

      // Real-time listeners for all data collections
      unsubs = [
        onSnapshot(collection(db, 'users', uid, 'tasks'), snap => {
          if (cancelled) return;
          cachedTasks = snap.docs.map(d => d.data());
          cachedTasksRef.current = cachedTasks;
          baseDispatch({ type: 'SET_TASKS', tasks: cachedTasks });
          if (!tasksFirstFired) { tasksFirstFired = true; tryRollover(); }
        }, onReadError),
        onSnapshot(collection(db, 'users', uid, 'scheduledBlocks'), snap => {
          if (!cancelled)
            baseDispatch({ type: 'SET_SCHEDULED_BLOCKS', scheduledBlocks: snap.docs.map(d => d.data()) });
        }, onReadError),
        onSnapshot(collection(db, 'users', uid, 'recurringTemplates'), snap => {
          if (cancelled) return;
          cachedTemplates = snap.docs.map(d => d.data());
          cachedTemplatesRef.current = cachedTemplates;
          baseDispatch({ type: 'SET_RECURRING_TEMPLATES', recurringTemplates: cachedTemplates });
          if (!templatesFirstFired) { templatesFirstFired = true; tryRollover(); }
        }, onReadError),
        onSnapshot(collection(db, 'users', uid, 'notes'), snap => {
          if (!cancelled)
            baseDispatch({ type: 'SET_NOTES', notes: snap.docs.map(d => d.data()) });
        }, onReadError),
        onSnapshot(doc(db, 'users', uid, 'settings', 'data'), snap => {
          if (cancelled) return;
          const isFirst = !settingsFirstFired;
          if (snap.exists()) {
            baseDispatch({ type: 'SET_SETTINGS', settings: snap.data(), hydrate: isFirst });
          }
          settingsReadyRef.current = true;
          if (isFirst) {
            settingsFirstFired = true;
            tryRollover();
          }
        }, onReadError),
      ];
    };

    init().catch(handleErrRef.current);

    return () => {
      cancelled = true;
      unsubs.forEach(u => u());
    };
  }, [uid, runDayTransition]);

  // Day transition: roll tasks over and generate recurring instances when the date changes.
  // Fires on a midnight timer when the app stays open, and again whenever the tab/PWA regains
  // visibility or focus — mobile browsers freeze long timers, so the timer alone is unreliable.
  useEffect(() => {
    if (!uid) return;

    let timer;

    const runTransition = () => {
      const todayStr = today();
      lastTransitionDateRef.current = todayStr;
      runDayTransition(cachedTasksRef.current, cachedTemplatesRef.current);
      dispatch({ type: 'GENERATE_RECURRING_FOR_DATE', dateStr: todayStr });
    };

    const schedule = () => {
      const n = new Date();
      const midnight = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 5);
      timer = setTimeout(() => { runTransition(); schedule(); }, midnight - n);
    };
    schedule();

    const onWake = () => {
      if (document.visibilityState === 'hidden') return;
      if (lastTransitionDateRef.current === today()) return; // still the same day
      clearTimeout(timer);
      runTransition();
      schedule(); // re-arm for the new day
    };

    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [uid, runDayTransition, dispatch]);

  // Debounced save of navigation/UI settings (not covered by per-action writes)
  useEffect(() => {
    if (!uid || !settingsReadyRef.current) return;
    const timer = setTimeout(() => {
      setDoc(doc(db, 'users', uid, 'settings', 'data'), {
        calendarMonth: state.calendarMonth,
        calendarYear: state.calendarYear,
        lastVisitDate: state.lastVisitDate,
        showCompletedTasks: state.showCompletedTasks,
        lastCompletedTask: state.lastCompletedTask,
        currentPlannerDate: state.currentPlannerDate,
      }, { merge: true }).catch(handleErrRef.current);
    }, 1000);
    return () => clearTimeout(timer);
  }, [
    uid,
    state.calendarMonth,
    state.calendarYear,
    state.lastVisitDate,
    state.showCompletedTasks,
    state.lastCompletedTask,
    state.currentPlannerDate,
  ]);

  return <AppContext.Provider value={{ state, dispatch, networkError }}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
