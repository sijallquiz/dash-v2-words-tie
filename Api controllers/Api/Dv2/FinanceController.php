<?php

namespace App\Http\Controllers\Api\Dv2;

use App\Http\Controllers\Controller;
use App\Models\Dv2\{FinanceClientInvoice, FinanceFreelancerInvoice};
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FinanceController extends Controller
{
    /**
     * GET /api/dashboard/v2/finance/client-invoices - جلب فواتير العملاء
     */
    public function clientInvoices(): JsonResponse
    {
        try {
            $invoices = FinanceClientInvoice::all();

            return response()->json([
                'success' => true,
                'data' => $invoices,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * POST /api/dashboard/v2/finance/client-invoices - إنشاء فاتورة عميل
     */
    public function storeClientInvoice(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'invoice_code' => 'required|string|unique:dv2_finance_client_invoices',
                'task_code' => 'required|string',
                'client_code' => 'required|string',
                'total_price' => 'required|numeric|min:0',
                'date_20' => 'nullable|date',
                'date_80' => 'nullable|date',
                'payment_20' => 'nullable|numeric',
                'payment_80' => 'nullable|numeric',
                'currency' => 'nullable|string',
                'note' => 'nullable|string',
            ]);

            $invoice = FinanceClientInvoice::create($validated);

            return response()->json([
                'success' => true,
                'message' => 'Invoice created successfully',
                'data' => $invoice,
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * PUT /api/dashboard/v2/finance/client-invoices/{id} - تحديث فاتورة عميل
     */
    public function updateClientInvoice(Request $request, FinanceClientInvoice $invoice): JsonResponse
    {
        try {
            $validated = $request->validate([
                'status' => 'nullable|in:pending,in_progress,completed',
                'date_20' => 'nullable|date',
                'date_80' => 'nullable|date',
                'payment_20' => 'nullable|numeric',
                'payment_80' => 'nullable|numeric',
                'note' => 'nullable|string',
            ]);

            $invoice->update($validated);

            return response()->json([
                'success' => true,
                'message' => 'Invoice updated successfully',
                'data' => $invoice,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * DELETE /api/dashboard/v2/finance/client-invoices/{id} - حذف فاتورة عميل
     */
    public function destroyClientInvoice(FinanceClientInvoice $invoice): JsonResponse
    {
        try {
            $invoice->delete();

            return response()->json([
                'success' => true,
                'message' => 'Invoice deleted successfully',
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /api/dashboard/v2/finance/freelancer-invoices - جلب فواتير المترجمين
     */
    public function freelancerInvoices(): JsonResponse
    {
        try {
            $invoices = FinanceFreelancerInvoice::all();

            return response()->json([
                'success' => true,
                'data' => $invoices,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * POST /api/dashboard/v2/finance/freelancer-invoices - إنشاء فاتورة مترجم
     */
    public function storeFreelancerInvoice(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'invoice_code' => 'required|string|unique:dv2_finance_freelancer_invoices',
                'task_code' => 'required|string',
                'freelancer_code' => 'required|string',
                'price' => 'required|numeric|min:0',
                'start_date' => 'nullable|date',
                'payment_date' => 'nullable|date',
                'currency' => 'nullable|string',
                'note' => 'nullable|string',
            ]);

            $invoice = FinanceFreelancerInvoice::create($validated);

            return response()->json([
                'success' => true,
                'message' => 'Invoice created successfully',
                'data' => $invoice,
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * PUT /api/dashboard/v2/finance/freelancer-invoices/{id} - تحديث فاتورة مترجم
     */
    public function updateFreelancerInvoice(Request $request, FinanceFreelancerInvoice $invoice): JsonResponse
    {
        try {
            $validated = $request->validate([
                'status' => 'nullable|in:pending,in_progress,completed',
                'price' => 'nullable|numeric|min:0',
                'start_date' => 'nullable|date',
                'payment_date' => 'nullable|date',
                'note' => 'nullable|string',
            ]);

            $invoice->update($validated);

            return response()->json([
                'success' => true,
                'message' => 'Invoice updated successfully',
                'data' => $invoice,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * DELETE /api/dashboard/v2/finance/freelancer-invoices/{id} - حذف فاتورة مترجم
     */
    public function destroyFreelancerInvoice(FinanceFreelancerInvoice $invoice): JsonResponse
    {
        try {
            $invoice->delete();

            return response()->json([
                'success' => true,
                'message' => 'Invoice deleted successfully',
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}