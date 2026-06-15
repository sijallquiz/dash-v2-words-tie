<?php

namespace App\Http\Controllers\Api\Dv2;

use App\Http\Controllers\Controller;
use App\Models\Dv2\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientController extends Controller
{
    /**
     * GET /api/dashboard/v2/clients - جلب جميع العملاء
     */
    public function index(): JsonResponse
    {
        try {
            $clients = Client::with(['tasks', 'creator'])->get();

            return response()->json([
                'success' => true,
                'data' => $clients,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * POST /api/dashboard/v2/clients - إنشاء عميل جديد
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'client_code' => 'required|string|unique:dv2_clients',
                'name' => 'required|string',
                'email' => 'required|email|unique:dv2_clients',
                'phone' => 'required|string|unique:dv2_clients',
                'agency' => 'nullable|string',
                'currency' => 'nullable|string',
                'notes' => 'nullable|string',
                'contact_people' => 'nullable|array',
            ]);

            $client = Client::create([
                ...$validated,
                'created_by' => auth()->id(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Client created successfully',
                'data' => $client,
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * GET /api/dashboard/v2/clients/{id} - عرض عميل واحد
     */
    public function show(Client $client): JsonResponse
    {
        try {
            $client->load(['tasks', 'creator']);

            return response()->json([
                'success' => true,
                'data' => $client,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * PUT /api/dashboard/v2/clients/{id} - تحديث عميل
     */
    public function update(Request $request, Client $client): JsonResponse
    {
        try {
            $validated = $request->validate([
                'name' => 'nullable|string',
                'email' => 'nullable|email|unique:dv2_clients,email,' . $client->id,
                'phone' => 'nullable|string|unique:dv2_clients,phone,' . $client->id,
                'agency' => 'nullable|string',
                'currency' => 'nullable|string',
                'notes' => 'nullable|string',
                'contact_people' => 'nullable|array',
            ]);

            $client->update($validated);

            return response()->json([
                'success' => true,
                'message' => 'Client updated successfully',
                'data' => $client,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * DELETE /api/dashboard/v2/clients/{id} - حذف عميل
     */
    public function destroy(Client $client): JsonResponse
    {
        try {
            $client->delete();

            return response()->json([
                'success' => true,
                'message' => 'Client deleted successfully',
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}