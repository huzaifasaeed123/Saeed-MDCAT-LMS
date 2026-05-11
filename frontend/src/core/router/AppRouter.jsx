import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Core
import DashboardLayout from '../layouts/DashboardLayout';
import PrivateRoute from '../auth/PrivateRoute';
import RoleBasedRoute from '../auth/RoleBasedRoute';

// Public pages
import HomePage from '../../modules/home/pages/HomePage';

// Auth module
import GoogleOneTap from '../../modules/auth/components/GoogleOneTap';
import LoginPage from '../../modules/auth/pages/LoginPage';
import RegisterPage from '../../modules/auth/pages/RegisterPage';
import ForgotPasswordPage from '../../modules/auth/pages/ForgotPasswordPage';
import ResetPasswordPage from '../../modules/auth/pages/ResetPasswordPage';

// Dashboard module
import DashboardPage from '../../modules/dashboard/pages/DashboardPage';

// Profile module
import ProfilePage from '../../modules/profile/pages/ProfilePage';

// Users module (admin)
import UsersPage from '../../modules/users/pages/UsersPage';
import NewUserPage from '../../modules/users/pages/NewUserPage';
import EditUserPage from '../../modules/users/pages/EditUserPage';

// Tests module
import TestListPage from '../../modules/tests/pages/TestListPage';
import TestFormPage from '../../modules/tests/pages/TestFormPage';
import TestDetailPage from '../../modules/tests/pages/TestDetailPage';
import TestStatsPage from '../../modules/tests/pages/TestStatsPage';
// Student test-taking
import TestStartPage from '../../modules/tests/pages/TestStartPage';
import TestPlayerPage from '../../modules/tests/pages/TestPlayerPage';
import TestResultPage from '../../modules/tests/pages/TestResultPage';
import TestAttemptReviewPage from '../../modules/tests/pages/TestAttemptReviewPage';
import TestHistoryPage from '../../modules/tests/pages/TestHistoryPage';

// MCQs module
import MCQFormPage from '../../modules/mcqs/pages/MCQFormPage';
import SequentialMCQEditorPage from '../../modules/mcqs/pages/SequentialMCQEditorPage';
import MCQDocumentUploadPage from '../../modules/mcqs/pages/MCQDocumentUploadPage';

// Courses module — admin
import CourseListPage from '../../modules/courses/pages/CourseListPage';
import CourseFormPage from '../../modules/courses/pages/CourseFormPage';
// Courses module — student
import CourseCatalogPage from '../../modules/courses/pages/student/CourseCatalogPage';
import CourseDetailPage from '../../modules/courses/pages/student/CourseDetailPage';

// Messages module
import MessagesPage from '../../modules/messages/pages/MessagesPage';

// Community module
import CommunityPage from '../../modules/community/pages/CommunityPage';

// Notes module
import NotesPage  from '../../modules/notes/pages/NotesPage';

// Videos module
import VideosPage from '../../modules/videos/pages/VideosPage';

// Settings module
import SettingsPage from '../../modules/settings/pages/SettingsPage';

// MCQ Reports module
import StudentMCQReportsPage from '../../modules/reports/pages/StudentMCQReportsPage';
import TeacherMCQReportsPage from '../../modules/reports/pages/TeacherMCQReportsPage';
import AdminMCQReportsPage   from '../../modules/reports/pages/AdminMCQReportsPage';

// Leaderboard module
import LeaderboardPage from '../../modules/leaderboard/pages/LeaderboardPage';

// Announcements module
import AnnouncementsAdminPage from '../../modules/announcements/pages/AnnouncementsAdminPage';

// Question Bank module
import QuestionBankListPage       from '../../modules/questionbank/pages/QuestionBankListPage';
import QuestionBankFormPage       from '../../modules/questionbank/pages/QuestionBankFormPage';
import QuestionBankDetailPage     from '../../modules/questionbank/pages/QuestionBankDetailPage';
import QuestionBankImportPage     from '../../modules/questionbank/pages/QuestionBankImportPage';
import QBMCQListPage              from '../../modules/questionbank/pages/QBMCQListPage';
import QBSequentialMCQEditorPage  from '../../modules/questionbank/pages/QBSequentialMCQEditorPage';
import QBManualPickPage           from '../../modules/questionbank/pages/QBManualPickPage';
import AutoTestGeneratorPage      from '../../modules/questionbank/pages/AutoTestGeneratorPage';

const AppRouter = () => {
  return (
    <Router>
      <GoogleOneTap />
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

        {/* Protected Routes with Dashboard Layout */}
        <Route element={<PrivateRoute />}>
          <Route
            path="/dashboard"
            element={
              <DashboardLayout>
                <DashboardPage />
              </DashboardLayout>
            }
          />
          <Route
            path="/profile"
            element={
              <DashboardLayout>
                <ProfilePage />
              </DashboardLayout>
            }
          />
          <Route
            path="/messages"
            element={
              <DashboardLayout>
                <MessagesPage />
              </DashboardLayout>
            }
          />
          <Route
            path="/community"
            element={
              <DashboardLayout>
                <CommunityPage />
              </DashboardLayout>
            }
          />
          <Route
            path="/notes"
            element={
              <DashboardLayout>
                <NotesPage />
              </DashboardLayout>
            }
          />
          <Route
            path="/videos"
            element={
              <DashboardLayout>
                <VideosPage />
              </DashboardLayout>
            }
          />

          {/* Admin Routes */}
          <Route element={<RoleBasedRoute allowedRoles={['admin']} />}>
            <Route
              path="/admin/users"
              element={
                <DashboardLayout>
                  <UsersPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/admin/users/new"
              element={
                <DashboardLayout>
                  <NewUserPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/admin/users/:id"
              element={
                <DashboardLayout>
                  <EditUserPage />
                </DashboardLayout>
              }
            />

            {/* Course Management Routes */}
            <Route
              path="/admin/courses"
              element={
                <DashboardLayout>
                  <CourseListPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/admin/courses/create"
              element={
                <DashboardLayout>
                  <CourseFormPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/admin/courses/:id/edit"
              element={
                <DashboardLayout>
                  <CourseFormPage />
                </DashboardLayout>
              }
            />

            {/* Question Bank Routes */}
            <Route
              path="/admin/question-banks"
              element={
                <DashboardLayout>
                  <QuestionBankListPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/admin/question-banks/create"
              element={
                <DashboardLayout>
                  <QuestionBankFormPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/admin/question-banks/:id/edit"
              element={
                <DashboardLayout>
                  <QuestionBankFormPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/admin/question-banks/:qbId/import"
              element={
                <DashboardLayout>
                  <QuestionBankImportPage />
                </DashboardLayout>
              }
            />

            {/* QB Detail */}
            <Route
              path="/admin/question-banks/:id"
              element={
                <DashboardLayout>
                  <QuestionBankDetailPage />
                </DashboardLayout>
              }
            />

            {/* QB MCQ List (filtered by topicId / chapterId / subjectId) */}
            <Route
              path="/admin/question-banks/:qbId/mcqs"
              element={
                <DashboardLayout>
                  <QBMCQListPage />
                </DashboardLayout>
              }
            />

            {/* QB Sequential MCQ Editor */}
            <Route
              path="/admin/question-banks/:qbId/mcqs/edit-all/:index"
              element={
                <DashboardLayout>
                  <QBSequentialMCQEditorPage />
                </DashboardLayout>
              }
            />

            {/* QB Single MCQ Edit — reuse MCQFormPage with QB context */}
            <Route
              path="/admin/question-banks/:qbId/mcqs/:mcqId/edit"
              element={
                <DashboardLayout>
                  <MCQFormPage />
                </DashboardLayout>
              }
            />

            {/* Auto Test Generator */}
            <Route
              path="/admin/auto-test"
              element={
                <DashboardLayout>
                  <AutoTestGeneratorPage />
                </DashboardLayout>
              }
            />

            {/* System Settings */}
            <Route
              path="/admin/settings"
              element={
                <DashboardLayout>
                  <SettingsPage />
                </DashboardLayout>
              }
            />

            {/* MCQ Reports — Admin */}
            <Route
              path="/admin/mcq-reports"
              element={
                <DashboardLayout>
                  <AdminMCQReportsPage />
                </DashboardLayout>
              }
            />
          </Route>

          {/* MCQ Reports — Teacher */}
          <Route element={<RoleBasedRoute allowedRoles={['admin', 'teacher']} />}>
            <Route
              path="/teacher/mcq-reports"
              element={
                <DashboardLayout>
                  <TeacherMCQReportsPage />
                </DashboardLayout>
              }
            />
            {/* Announcements admin — admin & teacher both can author */}
            <Route
              path="/admin/announcements"
              element={
                <DashboardLayout>
                  <AnnouncementsAdminPage />
                </DashboardLayout>
              }
            />
          </Route>

          {/* Test Management Routes - For Admin and Teachers */}
          <Route element={<RoleBasedRoute allowedRoles={['admin', 'teacher']} />}>
            {/* Test Routes */}
            <Route
              path="/tests"
              element={
                <DashboardLayout>
                  <TestListPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/tests/create"
              element={
                <DashboardLayout>
                  <TestFormPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/tests/:id"
              element={
                <DashboardLayout>
                  <TestDetailPage />
                </DashboardLayout>
              }
            />
            {/* Admin/teacher analytics for a single test */}
            <Route
              path="/tests/:id/stats"
              element={
                <DashboardLayout>
                  <TestStatsPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/tests/:id/edit"
              element={
                <DashboardLayout>
                  <TestFormPage />
                </DashboardLayout>
              }
            />

            {/* MCQ Import Route */}
            <Route
              path="/tests/:testId/import-mcqs"
              element={
                <DashboardLayout>
                  <MCQDocumentUploadPage />
                </DashboardLayout>
              }
            />

            {/* MCQ Routes */}
            <Route
              path="/tests/:testId/mcqs/create"
              element={
                <DashboardLayout>
                  <MCQFormPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/tests/:testId/mcqs/:mcqId/edit"
              element={
                <DashboardLayout>
                  <MCQFormPage />
                </DashboardLayout>
              }
            />
            {/* Sequential MCQ Editor Route */}
            <Route
              path="/tests/:testId/mcqs/edit-all/:index"
              element={
                <DashboardLayout>
                  <SequentialMCQEditorPage />
                </DashboardLayout>
              }
            />

            {/* Manual MCQ Pick from QB */}
            <Route
              path="/tests/:testId/pick-mcqs"
              element={
                <DashboardLayout>
                  <QBManualPickPage />
                </DashboardLayout>
              }
            />
          </Route>

          {/* Leaderboard — accessible to all authenticated users */}
          <Route
            path="/leaderboard"
            element={
              <DashboardLayout>
                <LeaderboardPage />
              </DashboardLayout>
            }
          />

          {/* Auto Test Generator — accessible to all authenticated users */}
          <Route
            path="/auto-test"
            element={
              <DashboardLayout>
                <AutoTestGeneratorPage />
              </DashboardLayout>
            }
          />

          {/* Student Course Routes — all authenticated users */}
          <Route
            path="/student/courses"
            element={
              <DashboardLayout>
                <CourseCatalogPage />
              </DashboardLayout>
            }
          />
          <Route
            path="/student/courses/:id"
            element={
              <DashboardLayout>
                <CourseDetailPage />
              </DashboardLayout>
            }
          />

          {/* MCQ Reports — Student */}
          <Route
            path="/student/mcq-reports"
            element={
              <DashboardLayout>
                <StudentMCQReportsPage />
              </DashboardLayout>
            }
          />

          {/* Student Test-Taking Routes — all authenticated users */}
          <Route
            path="/student/tests"
            element={
              <DashboardLayout>
                <TestHistoryPage />
              </DashboardLayout>
            }
          />
          <Route
            path="/student/tests/:testId"
            element={
              <DashboardLayout>
                <TestStartPage />
              </DashboardLayout>
            }
          />
          {/* TestPlayerPage: full-screen feel — no DashboardLayout wrapper */}
          <Route
            path="/student/tests/:testId/play"
            element={<TestPlayerPage />}
          />
          <Route
            path="/student/tests/:testId/result/:attemptId"
            element={
              <DashboardLayout>
                <TestResultPage />
              </DashboardLayout>
            }
          />
          <Route
            path="/student/tests/:testId/review/:attemptId"
            element={
              <DashboardLayout>
                <TestAttemptReviewPage />
              </DashboardLayout>
            }
          />
        </Route>

        {/* 404 Route */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <ToastContainer position="top-right" autoClose={3000} />
    </Router>
  );
};

export default AppRouter;
