<?php

namespace App\Http\Controllers\Api\Dv2;

use App\Http\Controllers\Controller;
use App\Models\Dv2\Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ServiceController extends Controller
{
    /**
     * GET /api/dashboard/v2/services - جلب جميع الخدمات
     */
    public function index(): JsonResponse
    {
        try {
            $services = Service::all();

            return response()->json([
                'success' => true,
                'data' => $services,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * POST /api/dashboard/v2/services - إنشاء خدمة جديدة
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'name' => 'required|string|unique:dv2_services',
                'slug' => 'required|string|unique:dv2_services',
                'description' => 'required|string',
                'status' => 'nullable|in:active,inactive',
            ]);

            $service = Service::create($validated);

            return response()->json([
                'success' => true,
                'message' => 'Service created successfully',
                'data' => $service,
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * PUT /api/dashboard/v2/services/{id} - تحديث خدمة
     */
    public function update(Request $request, Service $service): JsonResponse
    {
        try {
            $validated = $request->validate([
                'name' => 'nullable|string|unique:dv2_services,name,' . $service->id,
                'description' => 'nullable|string',
                'status' => 'nullable|in:active,inactive',
            ]);

            $service->update($validated);

            return response()->json([
                'success' => true,
                'message' => 'Service updated successfully',
                'data' => $service,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * DELETE /api/dashboard/v2/services/{id} - حذف خدمة
     */
    public function destroy(Service $service): JsonResponse
    {
        try {
            $service->delete();

            return response()->json([
                'success' => true,
                'message' => 'Service deleted successfully',
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}