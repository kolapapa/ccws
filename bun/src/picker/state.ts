import type { Workspace } from '../workspace.js';

export interface State {
  workspaces: Workspace[];
  query: string;
  cursorName: string | null;
}

export type Action =
  | { type: 'moveCursor'; dir: 'up' | 'down' }
  | { type: 'setQuery'; value: string }
  | { type: 'refreshWorkspaces'; workspaces: Workspace[] };

export function filtered(workspaces: Workspace[], query: string): Workspace[] {
  if (query === '') return workspaces;
  const q = query.toLowerCase();
  return workspaces.filter((w) => w.name.toLowerCase().includes(q));
}

export function initialState(workspaces: Workspace[], activeName: string | null): State {
  let cursorName: string | null = null;
  if (activeName && workspaces.some((w) => w.name === activeName)) {
    cursorName = activeName;
  } else if (workspaces.length > 0) {
    cursorName = workspaces[0]!.name;
  }
  return { workspaces, query: '', cursorName };
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'moveCursor': {
      const list = filtered(state.workspaces, state.query);
      if (list.length === 0) return state;
      const idx = list.findIndex((w) => w.name === state.cursorName);
      if (idx === -1) {
        return { ...state, cursorName: list[0]!.name };
      }
      const nextIdx = action.dir === 'down' ? idx + 1 : idx - 1;
      if (nextIdx < 0 || nextIdx >= list.length) return state;
      return { ...state, cursorName: list[nextIdx]!.name };
    }
    case 'setQuery': {
      const list = filtered(state.workspaces, action.value);
      let cursorName = state.cursorName;
      if (cursorName === null || !list.some((w) => w.name === cursorName)) {
        cursorName = list.length > 0 ? list[0]!.name : null;
      }
      return { ...state, query: action.value, cursorName };
    }
    case 'refreshWorkspaces': {
      const list = filtered(action.workspaces, state.query);
      let cursorName = state.cursorName;
      if (cursorName === null || !list.some((w) => w.name === cursorName)) {
        cursorName = list.length > 0 ? list[0]!.name : null;
      }
      return { ...state, workspaces: action.workspaces, cursorName };
    }
  }
}
