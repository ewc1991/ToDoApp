import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { auth } from '../firebase';
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

const localKey = (uid) => `planner-state-v1-${uid}`;

function getCachedState(uid) {
  try {
    const saved = localStorage.getItem(localKey(uid));
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

// Try to read per-user cache synchronously at startup (auth.currentUser is
// available immediately on page reload when Firebase has a cached session).
function getInitialState() {
  const uid = auth.currentUser?.uid;
  if (uid) {
    const cached = getCachedState(uid);
    if (cached) return applyLoadedState(cached);
  }
  return INITIAL_STATE;
}

function applyLoadedState(loaded) {
  const todayStr = today();
  // Always land on calendar page when state is loaded (login or page refresh)
  const merged = { ...INITIAL_STATE, ...loaded, currentPage: 'calendar' };
  if (merged.lastVisitDate !== todayStr) {
    return { ...merged, currentPlannerDate: null, lastVisitDate: todayStr, lastCompletedTask: null };
  }
  return merged;
}

function reducer(state, action) {
  switch (action.type) {

    case 'LOAD_STATE':
      return applyLoadedState(action.state);

    case 'ADD_TASK': {
      const task = {
        id: genId(), title: action.title, notes: action.notes || '',
        completed: false, assignedDate: action.assignedDate || null,
        recurringTemplateId: action.recurringTemplateId || null,
        createdAt: ts(), updatedAt: ts(),
      };
      return { ...state, tasks: [...state.tasks, task] };
    }

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
      orderedIds.forEach((id, i) => { newTasks[positions[i]] = taskMap[id]; });
      return { ...state, tasks: newTasks };
    }

    case 'ADD_SCHEDULED_BLOCK': {
      const block = {
        id: genId(), title: action.title, notes: action.notes || '',
        completed: false, date: action.date,
        startTime: action.startTime, endTime: action.endTime,
        todoTaskId: action.todoTaskId || null,
        createdAt: ts(), updatedAt: ts(),
      };
      return { ...state, scheduledBlocks: [...state.scheduledBlocks, block] };
    }

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

    case 'ADD_RECURRING_TEMPLATE': {
      const template = {
        id: genId(), title: action.title, notes: action.notes || '',
        recurrenceType: action.recurrenceType,
        dayOfWeek: action.dayOfWeek ?? null, dayOfMonth: action.dayOfMonth ?? null,
        startDate: action.startDate || null, endDate: action.endDate || null,
        createdAt: ts(), updatedAt: ts(),
      };
      return { ...state, recurringTemplates: [...state.recurringTemplates, template] };
    }

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
      const { dateStr } = action;
      if (state.generatedDates.includes(dateStr)) return state;
      const newTasks = state.recurringTemplates
        .filter(tmpl => shouldRecurOnDate(tmpl, dateStr))
        .map(tmpl => ({
          id: genId(), title: tmpl.title, notes: tmpl.notes, completed: false,
          assignedDate: dateStr, recurringTemplateId: tmpl.id,
          createdAt: ts(), updatedAt: ts(),
        }));
      return {
        ...state,
        tasks: [...state.tasks, ...newTasks],
        generatedDates: [...state.generatedDates, dateStr],
      };
    }

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

    default:
      return state;
  }
}

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, getInitialState);
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const firestoreReadyRef = useRef(false);

  useEffect(() => {
    if (!uid) {
      // Sign-out: clear app state so next user starts clean
      firestoreReadyRef.current = false;
      dispatch({ type: 'LOAD_STATE', state: INITIAL_STATE });
      return;
    }

    firestoreReadyRef.current = false;

    // Load per-user localStorage cache immediately for fast render
    const cached = getCachedState(uid);
    if (cached) dispatch({ type: 'LOAD_STATE', state: cached });

    // Then confirm with Firestore (authoritative source of truth)
    const load = async () => {
      const docRef = doc(db, 'users', uid, 'plannerState');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        firestoreReadyRef.current = true;
        dispatch({ type: 'LOAD_STATE', state: snap.data() });
      } else {
        // New account — initialize with clean state
        await setDoc(docRef, INITIAL_STATE);
        firestoreReadyRef.current = true;
      }
    };
    load().catch(console.error);
  }, [uid]);

  // Save to per-user localStorage on every change (instant cache)
  useEffect(() => {
    if (!uid) return;
    try { localStorage.setItem(localKey(uid), JSON.stringify(state)); } catch {}
  }, [state, uid]);

  // Debounced save to Firestore (1.5s after last change)
  useEffect(() => {
    if (!uid || !firestoreReadyRef.current) return;
    const timer = setTimeout(() => {
      const docRef = doc(db, 'users', uid, 'plannerState');
      setDoc(docRef, state).catch(console.error);
    }, 1500);
    return () => clearTimeout(timer);
  }, [state, uid]);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
