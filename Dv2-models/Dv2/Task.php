<?php

namespace App\Models\Dv2;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Task extends Model
{
    protected $table = 'dv2_tasks';

    protected $fillable = [
        'task_number',
        'client_code',
        'status',
        'words_count',
        'page_numbers',
        'language_pair',
        'start_date',
        'end_date',
        'start_time',
        'end_time',
        'notes',
        'link',
        'workflowStages',
        'created_by',
    ];

    protected $casts = [
        'language_pair' => 'array',
        'workflowStages' => 'array',
        'start_date' => 'date',
        'end_date' => 'date',
    ];

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_code', 'client_code');
    }

    public function services(): BelongsToMany
    {
        return $this->belongsToMany(
            Service::class,
            'dv2_task_services',
            'task_id',
            'service_id'
        );
    }

    public function media(): HasMany
    {
        return $this->hasMany(Media::class, 'mediaable_id')
            ->where('mediaable_type', Task::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(\App\Models\User::class, 'created_by');
    }
}