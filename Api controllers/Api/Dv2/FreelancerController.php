<?php

namespace App\Http\Controllers\Api\Dv2;

use App\Http\Controllers\Controller;
use App\Models\Dv2\Freelancer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FreelancerController extends Controller
{
    /**
     * GET /api/dashboard/v2/freelancers - جلب جميع المترجمين
     */
    public function index(): JsonResponse
    {
        try {
            $freelancers = Freelancer::all();

            return response()->json([
                'success' => true,
                'data' => $freelancers,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * POST /api/dashboard/v2/freelancers - إنشاء مترجم جديد
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'freelancer_code' => 'required|string|unique:dv2_freelancers',
                'name' => 'required|string',
                'email' => 'required|email|unique:dv2_freelancers',
                'phone' => 'required|string|unique:dv2_freelancers',
                'language_pair' => 'required|array',
                'quota' => 'required|string',
                'price_hr' => 'required|numeric|min:0',
                'currency' => 'required|string',
                'notes' => 'nullable|string',
            ]);

            $freelancer = Freelancer::create($validated);

            return response()->json([
                'success' => true,
                'message' => 'Freelancer created successfully',
                'data' => $freelancer,
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * GET /api/dashboard/v2/freelancers/{id} - عرض مترجم واحد
     */
    public function show(Freelancer $freelancer): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $freelancer,
        ]);
    }

    /**
     * PUT /api/dashboard/v2/freelancers/{id} - تحديث مترجم
     */
    public function update(Request $request, Freelancer $freelancer): JsonResponse
    {
        try {
            $validated = $request->validate([
                'name' => 'nullable|string',
                'email' => 'nullable|email|unique:dv2_freelancers,email,' . $freelancer->id,
                'phone' => 'nullable|string|unique:dv2_freelancers,phone,' . $freelancer->id,
                'language_pair' => 'nullable|array',
                'quota' => 'nullable|string',
                'price_hr' => 'nullable|numeric|min:0',
                'currency' => 'nullable|string',
                'notes' => 'nullable|string',
            ]);

            $freelancer->update($validated);

            return response()->json([
                'success' => true,
                'message' => 'Freelancer updated successfully',
                'data' => $freelancer,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * DELETE /api/dashboard/v2/freelancers/{id} - حذف مترجم
     */
    public function destroy(Freelancer $freelancer): JsonResponse
    {
        try {
            $freelancer->delete();

            return response()->json([
                'success' => true,
                'message' => 'Freelancer deleted successfully',
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}