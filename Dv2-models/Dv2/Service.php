<?php

namespace App\Models\Dv2;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Service extends Model
{
    protected $table = 'dv2_services';

    protected $fillable = [
        'name',
        'slug',
        'description',
        'status',
    ];

    public function tasks(): BelongsToMany
    {
        return $this->belongsToMany(
            Task::class,
            'dv2_task_services',
            'service_id',
            'task_id'
        );
    }
}