<?php

namespace App\Http\Controllers\Api\Dv2;

use App\Http\Controllers\Controller;
use App\Models\Dv2\ContactMessage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContactMessageController extends Controller
{
    /**
     * GET /api/dashboard/v2/contact-messages - جلب جميع الرسائل
     */
    public function index(): JsonResponse
    {
        try {
            $messages = ContactMessage::all();

            return response()->json([
                'success' => true,
                'data' => $messages,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * POST /api/dashboard/v2/contact-messages - إنشاء رسالة
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'name' => 'required|string',
                'email' => 'required|email',
                'phone' => 'nullable|string',
                'subject' => 'nullable|string',
                'message' => 'required|string',
            ]);

            $message = ContactMessage::create($validated);

            return response()->json([
                'success' => true,
                'message' => 'Message created successfully',
                'data' => $message,
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * DELETE /api/dashboard/v2/contact-messages/{id} - حذف رسالة
     */
    public function destroy(ContactMessage $message): JsonResponse
    {
        try {
            $message->delete();

            return response()->json([
                'success' => true,
                'message' => 'Message deleted successfully',
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}