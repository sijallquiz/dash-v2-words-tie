<?php

namespace App\Models\Dv2;

use Illuminate\Database\Eloquent\Model;

class Freelancer extends Model
{
    protected $table = 'dv2_freelancers';

    protected $fillable = [
        'freelancer_code',
        'name',
        'email',
        'phone',
        'language_pair',
        'quota',
        'price_hr',
        'currency',
        'notes',
    ];

    protected $casts = [
        'language_pair' => 'array',
    ];
}