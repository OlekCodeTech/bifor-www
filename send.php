<?php
declare(strict_types=1);

/* BIFOR — odbiór zgłoszeń z formularza „Umów prezentację” (dolacz.html).
   Formularz wysyła JSON metodą POST; skrypt sprawdza dane i wysyła e-mail
   na skrzynkę BIFOR. Niczego nie zapisuje na serwerze poza licznikiem
   zgłoszeń z jednego adresu IP (ochrona przed zalewaniem skrzynki). */

const MAIL_TO     = 'kontakt@bifor.pl';
const MAIL_FROM   = 'kontakt@bifor.pl';   // skrzynka w domenie strony — inaczej poczta trafi do spamu
const RATE_MAX    = 5;                    // tyle zgłoszeń z jednego IP…
const RATE_WINDOW = 3600;                 // …w ciągu godziny
const MIN_FILL_S  = 3;                    // szybciej wypełnia tylko bot

date_default_timezone_set('Europe/Warsaw');

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');

function out(int $code, array $data): never
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/** Tekst z formularza: bez znaków sterujących, przycięty do limitu. */
function clean(mixed $v, int $max, bool $multiline = false): string
{
    if (!is_string($v)) {
        return '';
    }
    $v = str_replace("\r\n", "\n", $v);
    $v = preg_replace($multiline ? '/[^\P{C}\n]/u' : '/\p{C}/u', $multiline ? '' : ' ', $v) ?? '';
    $v = trim($v);
    return function_exists('mb_substr') ? mb_substr($v, 0, $max, 'UTF-8') : substr($v, 0, $max);
}

function header_text(string $v): string
{
    return '=?UTF-8?B?' . base64_encode($v) . '?=';
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    out(405, ['ok' => false, 'error' => 'method']);
}

// zgłoszenie musi pochodzić z tej samej domeny co skrypt
$host   = strtolower(preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? '') ?? '');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && strtolower((string) parse_url($origin, PHP_URL_HOST)) !== $host) {
    out(403, ['ok' => false, 'error' => 'origin']);
}

$raw = file_get_contents('php://input', false, null, 0, 20000);
$d   = json_decode($raw === false ? '' : $raw, true);
if (!is_array($d)) {
    out(400, ['ok' => false, 'error' => 'json']);
}

// pułapka na boty: udajemy sukces, nic nie wysyłamy
if (!empty($d['company_website']) || (int) ($d['fill_seconds'] ?? 0) < MIN_FILL_S) {
    out(200, ['ok' => true]);
}

$first   = clean($d['first_name'] ?? '', 60);
$last    = clean($d['last_name'] ?? '', 80);
$email   = clean($d['email'] ?? '', 120);
$phone   = clean($d['phone'] ?? '', 20);
$company = clean($d['company'] ?? '', 120);
$street  = clean($d['street'] ?? '', 120);
$zip     = clean($d['postal_code'] ?? '', 6);
$city    = clean($d['city'] ?? '', 80);
$website = clean($d['website'] ?? '', 200);
$social  = clean($d['social'] ?? '', 200);
$message = clean($d['message'] ?? '', 1000, true);

$ROLES = [
    'wlasciciel_obiektu'   => 'Właściciel / właścicielka obiektu',
    'manager'              => 'Manager / managerka',
    'event_manager'        => 'Event manager',
    'sprzedaz_organizacja' => 'Sprzedaż / organizacja wydarzeń',
    'agencja_eventowa'     => 'Agencja eventowa',
    'uslugodawca'          => 'Usługodawca',
    'inne'                 => 'Inne',
];
$EVENTS = [
    'do_20'    => 'do 20',
    '21_50'    => '21–50',
    '51_100'   => '51–100',
    '101_200'  => '101–200',
    '200_plus' => 'powyżej 200',
];
$role   = $ROLES[$d['role'] ?? ''] ?? '';
$events = $EVENTS[$d['events_per_year'] ?? ''] ?? '';

$errors = [];
if (strlen($first) < 2)   { $errors[] = 'first_name'; }
if (strlen($last) < 2)    { $errors[] = 'last_name'; }
if (strlen($company) < 2) { $errors[] = 'company'; }
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) { $errors[] = 'email'; }
if (($d['consent_rodo'] ?? false) !== true)     { $errors[] = 'consent_rodo'; }
if ($errors) {
    out(422, ['ok' => false, 'error' => 'validation', 'fields' => $errors]);
}

// limit zgłoszeń z jednego adresu
$ip   = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$file = rtrim(sys_get_temp_dir(), '/\\') . '/bifor_form_' . hash('sha256', $ip) . '.json';
$now  = time();
$hits = [];
if (is_file($file)) {
    $hits = json_decode((string) @file_get_contents($file), true);
    $hits = is_array($hits) ? array_values(array_filter($hits, fn($t) => is_int($t) && $t > $now - RATE_WINDOW)) : [];
}
if (count($hits) >= RATE_MAX) {
    out(429, ['ok' => false, 'error' => 'rate']);
}
$hits[] = $now;
@file_put_contents($file, json_encode($hits), LOCK_EX);

// treść wiadomości
$line = fn(string $label, string $value): string => $value === '' ? '' : $label . ': ' . $value . "\n";
$address = trim($street . ', ' . trim($zip . ' ' . $city), ', ');
$source  = array_filter([
    'utm_source'   => clean($d['utm_source'] ?? '', 100),
    'utm_medium'   => clean($d['utm_medium'] ?? '', 100),
    'utm_campaign' => clean($d['utm_campaign'] ?? '', 100),
    'utm_content'  => clean($d['utm_content'] ?? '', 100),
    'skąd'         => clean($d['referrer'] ?? '', 300),
    'strona wejścia' => clean($d['landing_page'] ?? '', 300),
]);

$body  = "Nowe zgłoszenie z formularza „Umów prezentację” na bifor.pl\n\n";
$body .= $line('Imię i nazwisko', $first . ' ' . $last);
$body .= $line('E-mail', $email);
$body .= $line('Telefon', $phone);
$body .= $line('Rola', $role);
$body .= "\n";
$body .= $line('Firma / lokal', $company);
$body .= $line('Adres', $address);
$body .= $line('Strona', $website);
$body .= $line('Instagram / Facebook', $social);
$body .= $line('Wydarzeń rocznie', $events);
if ($message !== '') {
    $body .= "\nWiadomość:\n" . $message . "\n";
}
$body .= "\nZgoda na kontakt w sprawie zgłoszenia: tak\n";
$body .= 'Zgoda na informacje o nowościach BIFOR: ' . (($d['consent_marketing'] ?? false) === true ? 'tak' : 'nie') . "\n";
$body .= "\n--\nWysłano: " . date('Y-m-d H:i') . "\n";
foreach ($source as $k => $v) {
    $body .= $k . ': ' . $v . "\n";
}
$body .= "Odpowiedz na tę wiadomość, żeby napisać bezpośrednio do zgłaszającego.\n";

$subject = 'Prezentacja BIFOR: ' . $company . ' (' . $first . ' ' . $last . ')';
$headers = implode("\r\n", [
    'From: ' . header_text('BIFOR — formularz') . ' <' . MAIL_FROM . '>',
    'Reply-To: ' . header_text($first . ' ' . $last) . ' <' . $email . '>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    'X-Mailer: bifor.pl',
]);
$encoded = rtrim(chunk_split(base64_encode($body)));

// test lokalny: BIFOR_MAIL_DRYRUN=ścieżka zapisuje wiadomość do pliku zamiast wysyłać
$dry = getenv('BIFOR_MAIL_DRYRUN');
if (is_string($dry) && $dry !== '') {
    $sent = @file_put_contents($dry, "To: " . MAIL_TO . "\nSubject: " . $subject . "\n" . $headers . "\n\n" . $body) !== false;
} else {
    $sent = @mail(MAIL_TO, header_text($subject), $encoded, $headers, '-f' . MAIL_FROM);
}

if (!$sent) {
    error_log('BIFOR formularz: mail() nie wysłał zgłoszenia od ' . $email);
    out(500, ['ok' => false, 'error' => 'mail']);
}
out(200, ['ok' => true]);
