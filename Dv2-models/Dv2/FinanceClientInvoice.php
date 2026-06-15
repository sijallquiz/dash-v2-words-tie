<?php

namespace App\Models\Dv2;

use Illuminate\Database\Eloquent\Model;

class FinanceClientInvoice extends Model
{
    protected $table = 'dv2_finance_client_invoices';

    protected $fillable = [
        'invoice_code',
        'task_code',
        'client_code',
        'date_20',
        'date_80',
        'payment_20',
        'payment_80',
        'total_price',
        'status',
        'currency',
        'note',
    ];

    protected $casts = [
        'date_20' => 'date',
        'date_80' => 'date',
    ];
}