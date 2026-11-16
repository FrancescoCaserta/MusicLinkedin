import { useEffect } from 'react';
import { Route, Routes } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Shell } from './app/Shell';
import { api } from './data/client';
import { HiringPage, ManagePage } from './features/hiring/Hiring';
import { HomePage } from './features/home/Home';
import { MessagesPage } from './features/messages/Messages';
import { NetworkPage } from './features/network/Network';
import { OrganisationPage, OrganisationsPage } from './features/organisations/Organisations';
import { PostPage, UrgentPage } from './features/hiring/Post';
import { Demo, Enter, NotFound } from './features/landing/Demo';
import { Landing } from './features/landing/Landing';
import { CalendarPage } from './features/calendar/CalendarPage';
import { ApplicationsPage, OpportunitiesPage, OpportunityPage } from './features/opportunities/Opportunities';
import { ProfileEdit } from './features/profile/ProfileEdit';
import { ProfilePage } from './features/profile/ProfilePage';
import { SearchPage, ShortlistPage } from './features/search/SearchPage';

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
        <Route path="/home" element={<HomePage />} />
        <Route path="/network" element={<NetworkPage />} />
        <Route path="/ensembles" element={<OrganisationsPage />} />
        <Route path="/ensembles/:slug" element={<OrganisationPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/messages/:threadId" element={<MessagesPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/shortlist" element={<ShortlistPage />} />
        <Route path="/musicians/:slug" element={<ProfilePage />} />
        <Route path="/profile/edit" element={<ProfileEdit />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/opportunities" element={<OpportunitiesPage />} />
        <Route path="/opportunities/new" element={<PostPage />} />
        <Route path="/opportunities/urgent" element={<UrgentPage />} />
        <Route path="/opportunities/:id" element={<OpportunityPage />} />
        <Route path="/applications" element={<ApplicationsPage />} />
        <Route path="/hiring" element={<HiringPage />} />
        <Route path="/hiring/:id" element={<ManagePage />} />
        <Route path="*" element={<NotFound inside />} />
      </Route>
    </Routes>
  );
}
