import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { DEFAULT_CONFIG } from '../utils/defaults';

const ConfigContext = createContext({ ...DEFAULT_CONFIG, loaded: false, offline: false });

export function ConfigProvider({ children }) {
  const [state, setState] = useState({ ...DEFAULT_CONFIG, loaded: false, offline: false });

  useEffect(() => {
    let cancelled = false;
    api
      .get('/config')
      .then(({ data }) => !cancelled && setState({ ...data, loaded: true, offline: false }))
      .catch(() => !cancelled && setState((s) => ({ ...s, loaded: true, offline: true })));
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => state, [state]);
  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export const useConfig = () => useContext(ConfigContext);
