<?php

namespace App\Models\Dv2;

use Illuminate\Database\Eloquent\Model;

class FinanceFreelancerInvoice extends Model
{
    protected $table = 'dv2_finance_freelancer_invoices';

    protected $fillable = [
        'invoice_code',
        'task_code',
        'freelancer_code',
        'price',
        'start_date',
        'payment_date',
        'status',
        'currency',
        'note',
    ];

    protected $casts = [
        'start_date' => 'date',
        'payment_date' => 'date',
    ];
}