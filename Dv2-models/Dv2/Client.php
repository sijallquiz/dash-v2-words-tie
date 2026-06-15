<?php

namespace App\Models\Dv2;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Client extends Model
{
    protected $table = 'dv2_clients';

    protected $fillable = [
        'client_code',
        'name',
        'email',
        'phone',
        'agency',
        'currency',
        'notes',
        'contact_people',
        'created_by',
    ];

    protected $casts = [
        'contact_people' => 'array',
    ];

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class, 'client_code', 'client_code');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(\App\Models\User::class, 'created_by');
    }
}