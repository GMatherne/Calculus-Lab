import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthProvider";
import { ProgressProvider } from "./contexts/ProgressProvider";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { RoadmapPage } from "./pages/RoadmapPage";
import { ProfilePage } from "./pages/ProfilePage";
import { LessonPage } from "./pages/LessonPage";
import { PracticePage } from "./pages/PracticePage";
import { ReviewPage } from "./pages/ReviewPage";
import { CustomPracticePage } from "./pages/CustomPracticePage";
import { LevelReviewPage } from "./pages/LevelReviewPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";

// A data router (rather than the component <BrowserRouter>) so route components
// can use useBlocker to guard navigation away from an unfinished session.
// Created once at module scope so the router instance stays stable across
// re-renders; the providers stay above <RouterProvider> so route elements still
// see Auth/Progress context when rendered.
const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/signup", element: <SignupPage /> },
  {
    path: "/lessons",
    element: (
      <ProtectedRoute>
        <RoadmapPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/profile",
    element: (
      <ProtectedRoute>
        <ProfilePage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/lesson/:lessonId",
    element: (
      <ProtectedRoute>
        <LessonPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/lesson/:lessonId/practice",
    element: (
      <ProtectedRoute>
        <PracticePage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/review",
    element: (
      <ProtectedRoute>
        <ReviewPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/practice/custom",
    element: (
      <ProtectedRoute>
        <CustomPracticePage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/level/:levelId/review",
    element: (
      <ProtectedRoute>
        <LevelReviewPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/settings",
    element: (
      <ProtectedRoute>
        <SettingsPage />
      </ProtectedRoute>
    ),
  },
]);

function App() {
  return (
    <AuthProvider>
      <ProgressProvider>
        <RouterProvider router={router} />
      </ProgressProvider>
    </AuthProvider>
  );
}

export default App;
