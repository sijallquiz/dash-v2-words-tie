<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\Dv2\{
    DashboardController,
    TaskController,
    ClientController,
    FreelancerController,
    ServiceController,
    MediaController,
    FinanceController,
    ProjectRequestController,
    ContactMessageController,
};

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// Public Routes (لا تحتاج authentication)
Route::prefix('dashboard/v2')->group(function () {
    // Project Requests - يمكن للعموم إنشاء طلبات
    Route::post('project-requests', [ProjectRequestController::class, 'store']);
    
    // Contact Messages - يمكن للعموم إرسال رسائل
    Route::post('contact-messages', [ContactMessageController::class, 'store']);
});

// Protected Routes (تحتاج authentication)
Route::middleware('auth:sanctum')->prefix('dashboard/v2')->group(function () {
    
    // ============================================================
    // 📊 Dashboard - الداشبورد الرئيسي
    // ============================================================
    Route::controller(DashboardController::class)->prefix('dashboard')->group(function () {
        Route::get('/init', 'init')->name('dv2.dashboard.init');
        Route::get('/stats', 'stats')->name('dv2.dashboard.stats');
    });

    // ============================================================
    // 📋 Tasks - المهام
    // ============================================================
    Route::controller(TaskController::class)->prefix('tasks')->group(function () {
        Route::get('/', 'index')->name('dv2.tasks.index');
        Route::post('/', 'store')->name('dv2.tasks.store');
        Route::get('{task}', 'show')->name('dv2.tasks.show');
        Route::put('{task}', 'update')->name('dv2.tasks.update');
        Route::delete('{task}', 'destroy')->name('dv2.tasks.destroy');
        Route::get('filter/{status}', 'filter')->name('dv2.tasks.filter');
    });

    // ============================================================
    // 👥 Clients - العملاء
    // ============================================================
    Route::controller(ClientController::class)->prefix('clients')->group(function () {
        Route::get('/', 'index')->name('dv2.clients.index');
        Route::post('/', 'store')->name('dv2.clients.store');
        Route::get('{client}', 'show')->name('dv2.clients.show');
        Route::put('{client}', 'update')->name('dv2.clients.update');
        Route::delete('{client}', 'destroy')->name('dv2.clients.destroy');
    });

    // ============================================================
    // 🎯 Freelancers - المترجمين
    // ============================================================
    Route::controller(FreelancerController::class)->prefix('freelancers')->group(function () {
        Route::get('/', 'index')->name('dv2.freelancers.index');
        Route::post('/', 'store')->name('dv2.freelancers.store');
        Route::get('{freelancer}', 'show')->name('dv2.freelancers.show');
        Route::put('{freelancer}', 'update')->name('dv2.freelancers.update');
        Route::delete('{freelancer}', 'destroy')->name('dv2.freelancers.destroy');
    });

    // ============================================================
    // 🔧 Services - الخدمات
    // ============================================================
    Route::controller(ServiceController::class)->prefix('services')->group(function () {
        Route::get('/', 'index')->name('dv2.services.index');
        Route::post('/', 'store')->name('dv2.services.store');
        Route::put('{service}', 'update')->name('dv2.services.update');
        Route::delete('{service}', 'destroy')->name('dv2.services.destroy');
    });

    // ============================================================
    // 📁 Media - الملفات
    // ============================================================
    Route::controller(MediaController::class)->prefix('media')->group(function () {
        Route::post('upload', 'upload')->name('dv2.media.upload');
        Route::get('{media}/download', 'download')->name('dv2.media.download');
        Route::delete('{media}', 'destroy')->name('dv2.media.destroy');
        Route::get('by-entity/{type}/{id}', 'byEntity')->name('dv2.media.byEntity');
    });

    // ============================================================
    // 💰 Finance - المالية
    // ============================================================
    Route::prefix('finance')->group(function () {
        // Client Invoices
        Route::controller(FinanceController::class)->prefix('client-invoices')->group(function () {
            Route::get('/', 'clientInvoices')->name('dv2.finance.client.index');
            Route::post('/', 'storeClientInvoice')->name('dv2.finance.client.store');
            Route::put('{invoice}', 'updateClientInvoice')->name('dv2.finance.client.update');
            Route::delete('{invoice}', 'destroyClientInvoice')->name('dv2.finance.client.destroy');
        });

        // Freelancer Invoices
        Route::controller(FinanceController::class)->prefix('freelancer-invoices')->group(function () {
            Route::get('/', 'freelancerInvoices')->name('dv2.finance.freelancer.index');
            Route::post('/', 'storeFreelancerInvoice')->name('dv2.finance.freelancer.store');
            Route::put('{invoice}', 'updateFreelancerInvoice')->name('dv2.finance.freelancer.update');
            Route::delete('{invoice}', 'destroyFreelancerInvoice')->name('dv2.finance.freelancer.destroy');
        });
    });

    // ============================================================
    // 📝 Project Requests - طلبات الأسعار
    // ============================================================
    Route::controller(ProjectRequestController::class)->prefix('project-requests')->group(function () {
        Route::get('/', 'index')->name('dv2.requests.index');
        Route::get('{projectRequest}', 'show')->name('dv2.requests.show');
        Route::put('{projectRequest}', 'update')->name('dv2.requests.update');
        Route::delete('{projectRequest}', 'destroy')->name('dv2.requests.destroy');
    });

    // ============================================================
    // 💬 Contact Messages - الرسائل
    // ============================================================
    Route::controller(ContactMessageController::class)->prefix('contact-messages')->group(function () {
        Route::get('/', 'index')->name('dv2.messages.index');
        Route::delete('{message}', 'destroy')->name('dv2.messages.destroy');
    });
});

// ============================================================
// Standard Laravel Auth Routes (if using Sanctum)
// ============================================================
Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});