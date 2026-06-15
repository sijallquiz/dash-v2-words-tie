<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations - إنشاء جداول Dash-v2 المعزولة
     */
    public function up(): void
    {
        // ============================================================
        // 1️⃣ جدول الخدمات (Services)
        // ============================================================
        Schema::create('dv2_services', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('name')->unique()->comment('اسم الخدمة');
            $table->string('slug')->unique()->comment('الرابط الودي');
            $table->longText('description')->comment('الوصف');
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();
            $table->index('slug');
        });

        // ============================================================
        // 2️⃣ جدول العملاء (Clients)
        // ============================================================
        Schema::create('dv2_clients', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('client_code')->unique()->comment('كود العميل');
            $table->string('name')->comment('اسم العميل');
            $table->string('email')->unique()->comment('البريد الإلكتروني');
            $table->string('phone')->unique()->comment('رقم الهاتف');
            $table->string('agency')->nullable()->comment('اسم الوكالة');
            $table->string('currency')->default('USD')->comment('العملة');
            $table->longText('notes')->nullable()->comment('ملاحظات');
            $table->json('contact_people')->nullable()->comment('أشخاص التواصل');
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            $table->index('client_code');
            $table->index('name');
        });

        // ============================================================
        // 3️⃣ جدول المترجمين (Freelancers)
        // ============================================================
        Schema::create('dv2_freelancers', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('freelancer_code')->unique()->comment('كود المترجم');
            $table->string('name')->comment('الاسم');
            $table->string('email')->unique()->comment('البريد');
            $table->string('phone')->unique()->comment('الهاتف');
            $table->json('language_pair')->comment('أزواج اللغات');
            $table->string('quota')->comment('الإنتاجية اليومية');
            $table->decimal('price_hr', 8, 2)->comment('السعر بالساعة');
            $table->string('currency')->default('USD');
            $table->longText('notes')->nullable();
            $table->timestamps();
            
            $table->index('freelancer_code');
            $table->index('name');
        });

        // ============================================================
        // 4️⃣ جدول المهام (Tasks)
        // ============================================================
        Schema::create('dv2_tasks', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('task_number')->unique()->comment('رقم المهمة');
            $table->string('client_code')->comment('كود العميل');
            $table->enum('status', ['pending', 'in_progress', 'completed'])->default('pending');
            $table->string('words_count')->nullable()->comment('عدد الكلمات');
            $table->string('page_numbers')->nullable()->comment('عدد الصفحات');
            $table->json('language_pair')->nullable()->comment('زوج اللغات');
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->time('start_time')->nullable();
            $table->time('end_time')->nullable();
            $table->longText('notes')->nullable();
            $table->string('link')->nullable()->comment('رابط المشروع');
            $table->json('workflowStages')->nullable()->comment('مراحل سير العمل');
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            $table->index('task_number');
            $table->index('client_code');
            $table->index('status');
        });

        // ============================================================
        // 5️⃣ ربط المهام بالخدمات (Task Services Junction)
        // ============================================================
        Schema::create('dv2_task_services', function (Blueprint $table) {
            $table->unsignedBigInteger('task_id');
            $table->unsignedBigInteger('service_id');
            
            $table->primary(['task_id', 'service_id']);
            $table->foreign('task_id')->references('id')->on('dv2_tasks')->onDelete('cascade');
            $table->foreign('service_id')->references('id')->on('dv2_services')->onDelete('cascade');
        });

        // ============================================================
        // 6️⃣ جدول الملفات (Media)
        // ============================================================
        Schema::create('dv2_media', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('mediaable_id')->comment('ID الكائن المرتبط');
            $table->string('mediaable_type')->comment('نوع الكائن');
            $table->string('path')->comment('مسار الملف');
            $table->string('original_name')->comment('اسم الملف الأصلي');
            $table->string('mime_type')->comment('نوع الملف');
            $table->unsignedBigInteger('size')->comment('حجم الملف');
            $table->longText('note')->nullable();
            $table->string('file_status')->nullable()->comment('حالة الملف');
            $table->timestamps();
            
            $table->index(['mediaable_id', 'mediaable_type']);
        });

        // ============================================================
        // 7️⃣ فواتير العملاء (Client Invoices)
        // ============================================================
        Schema::create('dv2_finance_client_invoices', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('invoice_code')->unique()->comment('كود الفاتورة');
            $table->string('task_code')->comment('كود المهمة');
            $table->string('client_code')->comment('كود العميل');
            $table->date('date_20')->nullable()->comment('تاريخ الدفع الأول (20%)');
            $table->date('date_80')->nullable()->comment('تاريخ الدفع الثاني (80%)');
            $table->decimal('payment_20', 12, 2)->nullable()->comment('قيمة الدفع الأول');
            $table->decimal('payment_80', 12, 2)->nullable()->comment('قيمة الدفع الثاني');
            $table->decimal('total_price', 12, 2)->comment('إجمالي السعر');
            $table->enum('status', ['pending', 'in_progress', 'completed'])->default('pending');
            $table->string('currency')->default('USD');
            $table->longText('note')->nullable();
            $table->timestamps();
            
            $table->index('invoice_code');
            $table->index('client_code');
            $table->index('status');
        });

        // ============================================================
        // 8️⃣ فواتير المترجمين (Freelancer Invoices)
        // ============================================================
        Schema::create('dv2_finance_freelancer_invoices', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('invoice_code')->unique();
            $table->string('task_code');
            $table->string('freelancer_code');
            $table->decimal('price', 12, 2)->comment('قيمة الفاتورة');
            $table->date('start_date')->nullable();
            $table->date('payment_date')->nullable();
            $table->enum('status', ['pending', 'in_progress', 'completed'])->default('pending');
            $table->string('currency')->default('USD');
            $table->longText('note')->nullable();
            $table->timestamps();
            
            $table->index('invoice_code');
            $table->index('freelancer_code');
            $table->index('status');
        });

        // ============================================================
        // 9️⃣ طلبات الأسعار (Project Requests)
        // ============================================================
        Schema::create('dv2_project_requests', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('first_name');
            $table->string('last_name');
            $table->string('email');
            $table->string('project_name');
            $table->string('project_link')->nullable();
            $table->longText('description');
            $table->string('time_zone');
            $table->date('start_date');
            $table->time('start_date_time');
            $table->date('end_date');
            $table->time('end_date_time');
            $table->string('preferred_payment_type');
            $table->string('source_language');
            $table->string('target_language');
            $table->enum('status', ['pending', 'in_progress', 'completed'])->default('pending');
            $table->string('currency');
            $table->timestamps();
            
            $table->index('status');
        });

        // ============================================================
        // 🔟 رسائل التواصل (Contact Messages)
        // ============================================================
        Schema::create('dv2_contact_messages', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('name');
            $table->string('email');
            $table->string('phone')->nullable();
            $table->string('subject')->nullable();
            $table->longText('message');
            $table->timestamps();
            
            $table->index('email');
        });

        // ============================================================
        // 1️⃣1️⃣ جدول الأدوار والصلاحيات (Roles & Permissions) - اختياري
        // ============================================================
        Schema::create('dv2_roles', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('name')->unique();
            $table->json('permissions')->nullable();
            $table->timestamps();
        });

        // ============================================================
        // 1️⃣2️⃣ جدول الإعدادات (Settings)
        // ============================================================
        Schema::create('dv2_settings', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('key')->unique();
            $table->longText('value')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('dv2_settings');
        Schema::dropIfExists('dv2_roles');
        Schema::dropIfExists('dv2_contact_messages');
        Schema::dropIfExists('dv2_project_requests');
        Schema::dropIfExists('dv2_finance_freelancer_invoices');
        Schema::dropIfExists('dv2_finance_client_invoices');
        Schema::dropIfExists('dv2_media');
        Schema::dropIfExists('dv2_task_services');
        Schema::dropIfExists('dv2_tasks');
        Schema::dropIfExists('dv2_freelancers');
        Schema::dropIfExists('dv2_clients');
        Schema::dropIfExists('dv2_services');
    }
};