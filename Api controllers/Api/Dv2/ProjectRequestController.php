<?php

namespace App\Http\Controllers\Api\Dv2;

use App\Http\Controllers\Controller;
use App\Models\Dv2\ProjectRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProjectRequestController extends Controller
{
    /**
     * GET /api/dashboard/v2/project-requests - جلب جميع طلبات الأسعار
     */
    public function index(): JsonResponse
    {
        try {
            $requests = ProjectRequest::all();

            return response()->json([
                'success' => true,
                'data' => $requests,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * POST /api/dashboard/v2/project-requests - إنشاء طلب سعر
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'first_name' => 'required|string',
                'last_name' => 'required|string',
                'email' => 'required|email',
                'project_name' => 'required|string',
                'project_link' => 'nullable|url',
                'description' => 'required|string',
                'time_zone' => 'required|string',
                'start_date' => 'required|date',
                'start_date_time' => 'required',
                'end_date' => 'required|date',
                'end_date_time' => 'required',
                'preferred_payment_type' => 'required|string',
                'source_language' => 'required|string',
                'target_language' => 'required|string',
                'currency' => 'required|string',
            ]);

            $projectRequest = ProjectRequest::create($validated);

            return response()->json([
                'success' => true,
                'message' => 'Request created successfully',
                'data' => $projectRequest,
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * PUT /api/dashboard/v2/project-requests/{id} - تحديث طلب سعر
     */
    public function update(Request $request, ProjectRequest $projectRequest): JsonResponse
    {
        try {
            $validated = $request->validate([
                'status' => 'nullable|in:pending,in_progress,completed',
            ]);

            $projectRequest->update($validated);

            return response()->json([
                'success' => true,
                'message' => 'Request updated successfully',
                'data' => $projectRequest,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * DELETE /api/dashboard/v2/project-requests/{id} - حذف طلب سعر
     */
    public function destroy(ProjectRequest $projectRequest): JsonResponse
    {
        try {
            $projectRequest->delete();

            return response()->json([
                'success' => true,
                'message' => 'Request deleted successfully',
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}