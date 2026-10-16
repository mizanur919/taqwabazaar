<?php
// Receives product/banner images from the TaqwaBazaar app (src/lib/uploads.ts) and stores them
// in the images.taqwabazaar.com folder, which then serves them directly.
// Upload this folder as <images.taqwabazaar.com folder>/_upload/ together with upload-key.php and .htaccess.
//
// Every request is a POST with the header "X-Upload-Key: <key from upload-key.php>":
//   action=ping                          → { ok, writable, php }
//   action=upload, kind=<k>, file=<webp> → { ok, path: "<kind>/<yyyy>/<mm>/<name>.webp" }
//   action=delete, path=<path above>     → { ok }

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function reply(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    reply(405, ['ok' => false, 'error' => 'POST only']);
}

require __DIR__ . '/upload-key.php';
$given = $_SERVER['HTTP_X_UPLOAD_KEY'] ?? '';
if (!defined('UPLOAD_KEY') || strlen(UPLOAD_KEY) < 32 || !is_string($given) || !hash_equals(UPLOAD_KEY, $given)) {
    reply(401, ['ok' => false, 'error' => 'Unauthorized']);
}

// the subdomain's public folder (this script lives in its _upload/ subfolder)
$root = dirname(__DIR__);
$kinds = ['products', 'categories', 'brands', 'banners', 'branding'];
$pathPattern = '#^(' . implode('|', $kinds) . ')/\d{4}/\d{2}/[a-f0-9]{24}\.webp$#';
$action = $_POST['action'] ?? 'upload';

if ($action === 'ping') {
    reply(200, ['ok' => true, 'writable' => is_writable($root), 'php' => PHP_VERSION]);
}

if ($action === 'delete') {
    $rel = (string) ($_POST['path'] ?? '');
    if (!preg_match($pathPattern, $rel)) {
        reply(400, ['ok' => false, 'error' => 'Bad path']);
    }
    $file = $root . '/' . $rel;
    if (is_file($file)) {
        @unlink($file);
    }
    reply(200, ['ok' => true]);
}

if ($action !== 'upload') {
    reply(400, ['ok' => false, 'error' => 'Unknown action']);
}

$kind = (string) ($_POST['kind'] ?? '');
if (!in_array($kind, $kinds, true)) {
    reply(400, ['ok' => false, 'error' => 'Bad kind']);
}
$upload = $_FILES['file'] ?? null;
if (!$upload || ($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file($upload['tmp_name'])) {
    reply(400, ['ok' => false, 'error' => 'No file']);
}
if ($upload['size'] > 6 * 1024 * 1024) {
    reply(413, ['ok' => false, 'error' => 'Too large']);
}
// the app always sends WebP; check the real contents, not the name
$info = @getimagesize($upload['tmp_name']);
if (!$info || ($info['mime'] ?? '') !== 'image/webp') {
    reply(415, ['ok' => false, 'error' => 'Not a WebP image']);
}

$dir = $kind . '/' . date('Y') . '/' . date('m');
if (!is_dir($root . '/' . $dir) && !mkdir($root . '/' . $dir, 0755, true)) {
    reply(500, ['ok' => false, 'error' => 'Cannot create folder']);
}
$rel = $dir . '/' . bin2hex(random_bytes(12)) . '.webp';
if (!move_uploaded_file($upload['tmp_name'], $root . '/' . $rel)) {
    reply(500, ['ok' => false, 'error' => 'Cannot save file']);
}
@chmod($root . '/' . $rel, 0644);
reply(200, ['ok' => true, 'path' => $rel]);
