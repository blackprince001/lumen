import { createBrowserRouter } from 'react-router-dom';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Home from './pages/Home';
import PapersList from './pages/PapersList';
import PaperDetail from './pages/PaperDetail';
import Groups from './pages/Groups';
import GroupDetail from './pages/GroupDetail';
import Search from './pages/Search';
import Dashboard from './pages/Dashboard';
import Annotations from './pages/Annotations';
import Citations from './pages/Citations';
import Ingest from './pages/Ingest';
import Export from './pages/Export';
import Discovery from './pages/Discovery';
import Recommendations from './pages/Recommendations';
import DiscoveryArchive from './pages/DiscoveryArchive';
import HuggingFacePapers from './pages/HuggingFacePapers';
import Settings from './pages/Settings';
import UserManagement from './pages/UserManagement';
import ErrorPage from './pages/ErrorPage';

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Home /> },
      { path: 'papers', element: <PapersList /> },
      { path: 'papers/:id', element: <PaperDetail /> },
      { path: 'groups', element: <Groups /> },
      { path: 'groups/:id', element: <GroupDetail /> },
      { path: 'search', element: <Search /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'annotations', element: <Annotations /> },
      { path: 'citations', element: <Citations /> },
      { path: 'ingest', element: <Ingest /> },
      { path: 'export', element: <Export /> },
      { path: 'discovery', element: <Discovery /> },
      { path: 'recommendations', element: <Recommendations /> },
      { path: 'discovery-archive', element: <DiscoveryArchive /> },
      { path: 'huggingface-papers', element: <HuggingFacePapers /> },
      { path: 'settings', element: <Settings /> },
      {
        path: 'admin/users',
        element: (
          <ProtectedRoute requireAdmin>
            <UserManagement />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);
