<?php

namespace App\Models\Dv2;

use Illuminate\Database\Eloquent\Model;

class ProjectRequest extends Model
{
    protected $table = 'dv2_project_requests';

    protected $fillable = [
        'first_name',
        'last_name',
        'email',
        'project_name',
        'project_link',
        'description',
        'time_zone',
        'start_date',
        'start_date_time',
        'end_date',
        'end_date_time',
        'preferred_payment_type',
        'source_language',
        'target_language',
        'status',
        'currency',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
    ];
}