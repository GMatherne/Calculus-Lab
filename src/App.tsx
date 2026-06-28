import { lazy, Suspense, type ReactElement } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthProvider";
import { ProgressProvider } from "./contexts/ProgressProvider";
import { SessionInsightsProvider } from "./contexts/SessionInsightsProvider";
import { SoundProvider } from "./contexts/SoundProvider";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";

// Pages are code-split per route so the initial bundle stays small: each page
// (and its heavy dependencies — the lesson player pulls in math.js + KaTeX) is
// fetched on first navigation rather than up front. The pages use named exports,
// so each import is mapped to a `default` for React.lazy.
const LandingPage = lazy(() =>
  import("./pages/LandingPage").then((m) => ({ default: m.LandingPage })),
);
const LoginPage = lazy(() =>
  import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const SignupPage = lazy(() =>
  import("./pages/SignupPage").then((m) => ({ default: m.SignupPage })),
);
const RoadmapPage = lazy(() =>
  import("./pages/RoadmapPage").then((m) => ({ default: m.RoadmapPage })),
);
const ProfilePage = lazy(() =>
  import("./pages/ProfilePage").then((m) => ({ default: m.ProfilePage })),
);
const LessonPage = lazy(() =>
  import("./pages/LessonPage").then((m) => ({ default: m.LessonPage })),
);
const PracticePage = lazy(() =>
  import("./pages/PracticePage").then((m) => ({ default: m.PracticePage })),
);
const ReviewPage = lazy(() =>
  import("./pages/ReviewPage").then((m) => ({ default: m.ReviewPage })),
);
const CustomPracticePage = lazy(() =>
  import("./pages/CustomPracticePage").then((m) => ({
    default: m.CustomPracticePage,
  })),
);
const LevelReviewPage = lazy(() =>
  import("./pages/LevelReviewPage").then((m) => ({ default: m.LevelReviewPage })),
);
const TestOutPage = lazy(() =>
  import("./pages/TestOutPage").then((m) => ({ default: m.TestOutPage })),
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);

/** Shown briefly while a route's code chunk loads; sized to avoid layout jump. */
function RouteFallback() {
  return <div className="min-h-dvh" aria-busy="true" />;
}

/** Wrap a route element in a Suspense boundary for its lazy page chunk. */
const page = (node: ReactElement): ReactElement => (
  <Suspense fallback={<RouteFallback />}>{node}</Suspense>
);

// A data router (rather than the component <BrowserRouter>) so route components
// can use useBlocker to guard navigation away from an unfinished session.
// Created once at module scope so the router instance stays stable across
// re-renders; the providers stay above <RouterProvider> so route elements still
// see Auth/Progress context when rendered.
const router = createBrowserRouter([
  { path: "/", element: page(<LandingPage />) },
  { path: "/login", element: page(<LoginPage />) },
  { path: "/signup", element: page(<SignupPage />) },
  {
    path: "/lessons",
    element: page(
      <ProtectedRoute>
        <RoadmapPage />
      </ProtectedRoute>,
    ),
  },
  {
    path: "/profile",
    element: page(
      <ProtectedRoute>
        <ProfilePage />
      </ProtectedRoute>,
    ),
  },
  {
    path: "/lesson/:lessonId",
    element: page(
      <ProtectedRoute>
        <LessonPage />
      </ProtectedRoute>,
    ),
  },
  {
    path: "/lesson/:lessonId/practice",
    element: page(
      <ProtectedRoute>
        <PracticePage />
      </ProtectedRoute>,
    ),
  },
  {
    path: "/level/:levelId/test-out",
    element: page(
      <ProtectedRoute>
        <TestOutPage />
      </ProtectedRoute>,
    ),
  },
  {
    path: "/review",
    element: page(
      <ProtectedRoute>
        <ReviewPage />
      </ProtectedRoute>,
    ),
  },
  {
    path: "/practice/custom",
    element: page(
      <ProtectedRoute>
        <CustomPracticePage />
      </ProtectedRoute>,
    ),
  },
  {
    path: "/level/:levelId/review",
    element: page(
      <ProtectedRoute>
        <LevelReviewPage />
      </ProtectedRoute>,
    ),
  },
  {
    path: "/settings",
    element: page(
      <ProtectedRoute>
        <SettingsPage />
      </ProtectedRoute>,
    ),
  },
]);

function App() {
  return (
    <AuthProvider>
      <ProgressProvider>
        <SessionInsightsProvider>
          <SoundProvider>
            <RouterProvider router={router} />
          </SoundProvider>
        </SessionInsightsProvider>
      </ProgressProvider>
    </AuthProvider>
  );
}

export default App;
