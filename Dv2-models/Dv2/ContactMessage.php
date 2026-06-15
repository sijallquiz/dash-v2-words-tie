<?php

namespace App\Models\Dv2;

use Illuminate\Database\Eloquent\Model;

class ContactMessage extends Model
{
    protected $table = 'dv2_contact_messages';

    protected $fillable = [
        'name',
        'email',
        'phone',
        'subject',
        'message',
    ];
}