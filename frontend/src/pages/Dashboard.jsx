// import React from 'react';
// import useAuth from '../hooks/useAuth';
// import { FiUsers, FiBookOpen, FiFileText, FiBarChart2 } from 'react-icons/fi';

// const Dashboard = () => {
//   const { user, isAdmin, isTeacher, isStudent } = useAuth();
  
//   return (
//     <div className="dashboard-page">
//       <div className="mb-8">
//         <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
//         <p className="text-gray-600">Welcome back, {user?.fullName}!</p>
//       </div>
      
//       {isAdmin && <AdminDashboardContent />}
//       {isTeacher && <TeacherDashboardContent />}
//       {isStudent && <StudentDashboardContent />}
//     </div>
//   );
// };

// const AdminDashboardContent = () => {
//   return (
//     <div>
//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
//         <StatCard 
//           title="Total Users" 
//           value="0" 
//           icon={<FiUsers className="w-8 h-8" />} 
//           color="bg-blue-500" 
//         />
//         <StatCard 
//           title="Active Courses" 
//           value="0" 
//           icon={<FiBookOpen className="w-8 h-8" />} 
//           color="bg-green-500" 
//         />
//         <StatCard 
//           title="Total MCQs" 
//           value="0" 
//           icon={<FiFileText className="w-8 h-8" />} 
//           color="bg-yellow-500" 
//         />
//         <StatCard 
//           title="System Uptime" 
//           value="100%" 
//           icon={<FiBarChart2 className="w-8 h-8" />} 
//           color="bg-purple-500" 
//         />
//       </div>
      
//       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//         <div className="bg-white rounded-lg shadow p-6">
//           <h2 className="text-lg font-medium text-gray-800 mb-4">Recent User Registrations</h2>
//           <div className="text-gray-500 text-center py-8">
//             No recent registrations to display
//           </div>
//         </div>
        
//         <div className="bg-white rounded-lg shadow p-6">
//           <h2 className="text-lg font-medium text-gray-800 mb-4">System Activity</h2>
//           <div className="text-gray-500 text-center py-8">
//             No recent activities to display
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// const TeacherDashboardContent = () => {
//   return (
//     <div>
//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
//         <StatCard 
//           title="Pending Queries" 
//           value="0" 
//           icon={<FiUsers className="w-8 h-8" />} 
//           color="bg-blue-500" 
//         />
//         <StatCard 
//           title="MCQs Created" 
//           value="0" 
//           icon={<FiFileText className="w-8 h-8" />} 
//           color="bg-green-500" 
//         />
//         <StatCard 
//           title="Active Students" 
//           value="0" 
//           icon={<FiBarChart2 className="w-8 h-8" />} 
//           color="bg-purple-500" 
//         />
//       </div>
      
//       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//         <div className="bg-white rounded-lg shadow p-6">
//           <h2 className="text-lg font-medium text-gray-800 mb-4">Recent Queries</h2>
//           <div className="text-gray-500 text-center py-8">
//             No recent queries to display
//           </div>
//         </div>
        
//         <div className="bg-white rounded-lg shadow p-6">
//           <h2 className="text-lg font-medium text-gray-800 mb-4">Recent MCQs</h2>
//           <div className="text-gray-500 text-center py-8">
//             No recent MCQs to display
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// const StudentDashboardContent = () => {
//   return (
//     <div>
//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
//         <DashboardCard 
//           title="My Courses" 
//           description="Access your enrolled courses"
//           icon={<FiBookOpen className="w-8 h-8" />}
//           path="/student/courses"
//           color="bg-blue-500"
//         />
        
//         <DashboardCard 
//           title="Practice Tests" 
//           description="Take MCQ tests to prepare for MDCAT"
//           icon={<FiFileText className="w-8 h-8" />}
//           path="/student/tests"
//           color="bg-green-500"
//         />
        
//         <DashboardCard 
//           title="Performance" 
//           description="View your progress and analytics"
//           icon={<FiBarChart2 className="w-8 h-8" />}
//           path="/student/performance"
//           color="bg-yellow-500"
//         />
        
//         <DashboardCard 
//           title="Community" 
//           description="Engage with other students and teachers"
//           icon={<FiUsers className="w-8 h-8" />}
//           path="/student/community"
//           color="bg-purple-500"
//         />
//       </div>
      
//       <div className="bg-white rounded-lg shadow p-6">
//         <h2 className="text-lg font-medium text-gray-800 mb-4">Recent Activity</h2>
//         <div className="text-gray-500 text-center py-8">
//           No recent activity to show. Start learning to see your progress here!
//         </div>
//       </div>
//     </div>
//   );
// };

// const StatCard = ({ title, value, icon, color }) => {
//   return (
//     <div className="bg-white rounded-lg shadow overflow-hidden">
//       <div className="p-5">
//         <div className="flex items-center">
//           <div className={`rounded-md p-3 ${color} text-white`}>
//             {icon}
//           </div>
//           <div className="ml-5">
//             <p className="text-gray-500 text-sm">{title}</p>
//             <p className="text-2xl font-bold text-gray-800">{value}</p>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// import { Link } from 'react-router-dom';

// const DashboardCard = ({ title, description, icon, path, color }) => (
//   <div className="bg-white rounded-lg shadow overflow-hidden">
//     <div className="p-5">
//       <div className={`rounded-full p-3 ${color} text-white inline-block mb-3`}>
//         {icon}
//       </div>
//       <h3 className="text-lg font-medium text-gray-800 mb-2">{title}</h3>
//       <p className="text-gray-600 mb-4">{description}</p>

//       <Link
//         to={path}
//         className="text-primary-600 font-medium hover:text-primary-700 transition-colors duration-200"
//       >
//         View Details →
//       </Link>
//     </div>
//   </div>
// );


// export default Dashboard;


import React from 'react';
import useAuth from '../hooks/useAuth';
import AdminDashboard from '../components/dashboard/AdminDashboard';
import TeacherDashboard from '../components/dashboard/TeacherDashboard';
import StudentDashboard from '../components/dashboard/StudentDashboard';

const Dashboard = () => {
  const { user, isAdmin, isTeacher, isStudent } = useAuth();
  
  return (
    <div className="dashboard-page">
      {isAdmin && <AdminDashboard />}
      {isTeacher && <TeacherDashboard />}
      {isStudent && <StudentDashboard />}
    </div>
  );
};

export default Dashboard;