<?php

namespace App\Http\Controllers\Api\Dv2;

use App\Http\Controllers\Controller;
use App\Models\Dv2\{
    Task, Client, Freelancer, Service, 
    FinanceClientInvoice, FinanceFreelancerInvoice,
    ProjectRequest, ContactMessage, Role, Setting
};
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    /**
     * Initialize dashboard - تحميل كل البيانات للداشبورد
     */
    public function init(): JsonResponse
    {
        try {
            $user = auth()->user();

            // الحصول على الأدوار والصلاحيات
            $userRoles = $user->roles()->get() ?? collect([]);

            $data = [
                // بيانات المستخدم الحالي
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $userRoles->first()?->name ?? 'User',
                    'phone' => $user->phone ?? null,
                ],

                // جميع البيانات الأساسية
                'tasks' => Task::all(),
                'clients' => Client::all(),
                'freelancers' => Freelancer::all(),
                'services' => Service::where('status', 'active')->get(),
                'roles' => Role::all(),

                // البيانات المالية
                'clientInvoices' => FinanceClientInvoice::all(),
                'freelancerInvoices' => FinanceFreelancerInvoice::all(),

                // طلبات خارجية
                'projectRequests' => ProjectRequest::all(),
                'contactMessages' => ContactMessage::all(),

                // الإعدادات
                'settings' => Setting::all()->pluck('value', 'key'),
            ];

            return response()->json([
                'success' => true,
                'message' => 'Dashboard initialized',
                'data' => $data,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error initializing dashboard: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get dashboard statistics - الإحصائيات السريعة
     */
    public function stats(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'total_tasks' => Task::count(),
                'pending_tasks' => Task::where('status', 'pending')->count(),
                'in_progress_tasks' => Task::where('status', 'in_progress')->count(),
                'completed_tasks' => Task::where('status', 'completed')->count(),

                'total_clients' => Client::count(),
                'total_freelancers' => Freelancer::count(),
                'total_services' => Service::where('status', 'active')->count(),

                'pending_invoices' => FinanceClientInvoice::where('status', 'pending')->count(),
                'total_revenue' => FinanceClientInvoice::sum('total_price'),
                'total_expenses' => FinanceFreelancerInvoice::sum('price'),

                'new_requests' => ProjectRequest::where('status', 'pending')->count(),
                'new_messages' => ContactMessage::count(),
            ],
        ]);
    }
}