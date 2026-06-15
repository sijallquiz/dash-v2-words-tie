<?php

namespace App\Http\Controllers\Api\Dv2;

use App\Http\Controllers\Controller;
use App\Models\Dv2\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TaskController extends Controller
{
    /**
     * GET /api/dashboard/v2/tasks - جلب جميع المهام
     */
    public function index(): JsonResponse
    {
        try {
            $tasks = Task::with(['client', 'services', 'creator', 'media'])->get();

            return response()->json([
                'success' => true,
                'data' => $tasks,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * POST /api/dashboard/v2/tasks - إنشاء مهمة جديدة
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'task_number' => 'required|string|unique:dv2_tasks',
                'client_code' => 'required|string',
                'language_pair' => 'required|array',
                'start_date' => 'required|date',
                'end_date' => 'required|date',
                'words_count' => 'nullable|string',
                'page_numbers' => 'nullable|string',
                'notes' => 'nullable|string',
                'link' => 'nullable|url',
            ]);

            $task = Task::create([
                ...$validated,
                'created_by' => auth()->id(),
                'status' => 'pending',
            ]);

            // إضافة الخدمات إذا كانت موجودة
            if ($request->has('services')) {
                $task->services()->sync($request->input('services'));
            }

            return response()->json([
                'success' => true,
                'message' => 'Task created successfully',
                'data' => $task->load(['client', 'services', 'creator']),
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * GET /api/dashboard/v2/tasks/{id} - عرض مهمة واحدة
     */
    public function show(Task $task): JsonResponse
    {
        try {
            $task->load(['client', 'services', 'creator', 'media']);

            return response()->json([
                'success' => true,
                'data' => $task,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * PUT /api/dashboard/v2/tasks/{id} - تحديث مهمة
     */
    public function update(Request $request, Task $task): JsonResponse
    {
        try {
            $validated = $request->validate([
                'status' => 'nullable|in:pending,in_progress,completed',
                'words_count' => 'nullable|string',
                'page_numbers' => 'nullable|string',
                'notes' => 'nullable|string',
                'link' => 'nullable|url',
                'workflowStages' => 'nullable|array',
                'services' => 'nullable|array',
            ]);

            $task->update($validated);

            // تحديث الخدمات
            if ($request->has('services')) {
                $task->services()->sync($request->input('services'));
            }

            return response()->json([
                'success' => true,
                'message' => 'Task updated successfully',
                'data' => $task->load(['client', 'services']),
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * DELETE /api/dashboard/v2/tasks/{id} - حذف مهمة
     */
    public function destroy(Task $task): JsonResponse
    {
        try {
            $task->delete();

            return response()->json([
                'success' => true,
                'message' => 'Task deleted successfully',
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /api/dashboard/v2/tasks/filter/{status} - تصفية المهام
     */
    public function filter($status): JsonResponse
    {
        try {
            $tasks = Task::where('status', $status)
                ->with(['client', 'services', 'creator'])
                ->get();

            return response()->json([
                'success' => true,
                'data' => $tasks,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}