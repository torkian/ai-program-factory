export const db = {
  programs: new Map<string, any>(),
  sessions: new Map<string, any>(),
  artifacts: new Map<string, any>()
};

export const id = () => Math.random().toString(36).slice(2);