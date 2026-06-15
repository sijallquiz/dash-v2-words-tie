<?php

namespace App\Models\Dv2;

use Illuminate\Database\Eloquent\Model;

class Role extends Model
{
    protected $table = 'dv2_roles';

    protected $fillable = [
        'name',
        'permissions',
    ];

    protected $casts = [
        'permissions' => 'array',
    ];
}