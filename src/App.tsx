import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProgressProvider } from "./contexts/ProgressContext";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { RoadmapPage } from "./pages/RoadmapPage";
import { LessonPage } from "./pages/LessonPage";
import { PracticePage } from "./pages/PracticePage";
import { ReviewPage } from "./pages/ReviewPage";
import { LevelReviewPage } from "./pages/LevelReviewPage";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";

function App() {
  return (
    <AuthProvider>
      <ProgressProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route
              path="/lessons"
              element={
                <ProtectedRoute>
                  <RoadmapPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lesson/:lessonId"
              element={
                <ProtectedRoute>
                  <LessonPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lesson/:lessonId/practice"
              element={
                <ProtectedRoute>
                  <PracticePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/review"
              element={
                <ProtectedRoute>
                  <ReviewPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/level/:levelId/review"
              element={
                <ProtectedRoute>
                  <LevelReviewPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </ProgressProvider>
    </AuthProvider>
  );
}

export default App;
