import { useEffect } from 'react';
import { Route, Routes } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Shell } from './app/Shell';
import { api } from './data/client';
import { Demo, Enter, NotFound } from './features/landing/Demo';
import { Landing } from './features/landing/Landing';

export function App() {
  const client = useQueryClient();
  // The mock backend tells us when something changed behind our back
  // (a simulated answer arrived, or another tab wrote to the same data).
  useEffect(() => {
    const off = api.subscribe(() => void client.invalidateQueries());
    const timer = window.setInterval(() => void api.poll(), 4000);
    return () => {
      off();
      window.clearInterval(timer);
    };
  }, [client]);

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/demo" element={<Demo />} />
      <Route path="/enter/:accountId" element={<Enter />} />
      <Route element={<Shell />}>
        <Route path="*" element={<NotFound inside />} />
      </Route>
    </Routes>
  );
}
