<?php
// public/api/dashboard.php
session_start();
header('Content-Type: application/json; charset=utf-8');

// Session authentication check
if (!isset($_SESSION['username'])) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized: Please log in first.']);
    exit;
}

require_once __DIR__ . '/Database.php';

try {
    $db = (new Database())->getConnection();

    // 1. Total Patients count
    $patientStmt = $db->query("SELECT COUNT(*) as count FROM patients");
    $totalPatients = $patientStmt->fetch()['count'];

    // 2. Total Doctors count
    $doctorStmt = $db->query("SELECT COUNT(*) as count FROM doctors");
    $totalDoctors = $doctorStmt->fetch()['count'];

    // 3. Appointments summary counts
    $appStmt = $db->query("SELECT COUNT(*) as count FROM appointments");
    $totalAppointments = $appStmt->fetch()['count'];

    $pendingStmt = $db->query("SELECT COUNT(*) as count FROM appointments WHERE status = 'Pending'");
    $pendingAppointments = $pendingStmt->fetch()['count'];

    $confirmedStmt = $db->query("SELECT COUNT(*) as count FROM appointments WHERE status = 'Confirmed'");
    $confirmedAppointments = $confirmedStmt->fetch()['count'];

    // 4. Fetch 5 upcoming appointments
    $upcomingQuery = "SELECT 
                        a.id, 
                        a.appointment_date, 
                        a.status,
                        p.first_name AS patient_first, 
                        p.last_name AS patient_last,
                        d.first_name AS doctor_first, 
                        d.last_name AS doctor_last,
                        d.specialization
                      FROM appointments a
                      JOIN patients p ON a.patient_id = p.id
                      JOIN doctors d ON a.doctor_id = d.id
                      WHERE a.appointment_date >= NOW() OR a.status = 'Pending'
                      ORDER BY a.appointment_date ASC
                      LIMIT 5";
                      
    $upcomingStmt = $db->prepare($upcomingQuery);
    $upcomingStmt->execute();
    $upcomingAppointments = $upcomingStmt->fetchAll();

    echo json_encode([
        'status' => 'success',
        'data' => [
            'metrics' => [
                'total_patients' => (int)$totalPatients,
                'total_doctors' => (int)$totalDoctors,
                'total_appointments' => (int)$totalAppointments,
                'pending_appointments' => (int)$pendingAppointments,
                'confirmed_appointments' => (int)$confirmedAppointments
            ],
            'upcoming' => $upcomingAppointments
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Internal dashboard data retrieval error: ' . $e->getMessage()
    ]);
}
