<?php

namespace App\Models\Dv2;

use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    protected $table = 'dv2_settings';

    protected $fillable = ['key', 'value'];

    public static function get($key, $default = null)
    {
        $setting = self::where('key', $key)->first();
        return $setting?->value ?? $default;
    }

    public static function set($key, $value)
    {
        return self::updateOrCreate(['key' => $key], ['value' => $value]);
    }
}