<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\Website\ContactController;
use App\Http\Controllers\Website\HomeController;
use App\Http\Controllers\Website\PriceRequestController;
use App\Http\Controllers\WebsiteController;
use Illuminate\Support\Facades\Route;

// --- 1. Dashboard Routes (Must be required first to register dashboard prefix) ---
require __DIR__ . '/dashboard.php';

// --- 2. Auth Routes ---
require __DIR__ . '/auth.php';

// --- 3. Frontend Static Routes ---
Route::get('/', [HomeController::class, 'index'])->name('home');
Route::get('/price-request', [PriceRequestController::class, 'index'])->name('price-request');
Route::post('/price-request', [PriceRequestController::class, 'store'])->name('price-request.store');
Route::post('/contact', [ContactController::class, 'store'])->name('contact.store');
Route::get('/contact', [App\Http\Controllers\WebsiteController::class, 'contact'])->name('contact');
Route::get('/about', [App\Http\Controllers\WebsiteController::class, 'about'])->name('about');

// --- 4. Content Management Routes (Specific patterns first) ---

// مسار البحث الشامل
Route::get('/search', [\App\Http\Controllers\WebsiteController::class, 'search'])->name('search.index');

// Services
Route::get('/services', [WebsiteController::class, 'indexServices'])->name('services.index');
Route::get('/services/{slug}', [\App\Http\Controllers\WebsiteController::class, 'showService'])->name('service.show');
Route::get('/industries/{slug}', [\App\Http\Controllers\WebsiteController::class, 'showIndustry'])->name('industries.show');

Route::get('/industries', [\App\Http\Controllers\WebsiteController::class, 'indexIndustries'])->name('industries.index');

// Articles & Categories
Route::get('/articles', [WebsiteController::class, 'indexArticles'])->name('articles.index');
Route::get('/articles/categories/{slug}', [WebsiteController::class, 'categoryArticles'])->name('articles.category');
Route::get('/articles/{slug}', [WebsiteController::class, 'showArticle'])->name('article.show');



// --- 5. Auth Middleware (Profile management) ---
Route::middleware('auth')->as('dashboard.')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

// --- 6. Catch-all Pages Route (Must be last to avoid overriding other routes) ---
Route::get('/{slug}', [WebsiteController::class, 'showPage'])->name('page.show');