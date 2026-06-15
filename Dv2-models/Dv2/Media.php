<?php

namespace App\Models\Dv2;

use Illuminate\Database\Eloquent\Model;

class Media extends Model
{
    protected $table = 'dv2_media';

    protected $fillable = [
        'mediaable_id',
        'mediaable_type',
        'path',
        'original_name',
        'mime_type',
        'size',
        'note',
        'file_status',
    ];
}