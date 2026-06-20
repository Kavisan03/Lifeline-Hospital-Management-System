<?php
// src/Models/Appointment.php

require_once __DIR__ . '/Database.php';

class Appointment {
    private PDO $db;

    public function __construct() {
        $this->db = (new Database())->getConnection();
    }

    /**
     * Fetch all appointments with patient and doctor details.
     * 
     * @return array
     */
    public function getAll(): array {
        $query = "SELECT 
                    a.id, 
                    a.patient_id, 
                    a.doctor_id, 
                    a.appointment_date, 
                    a.status, 
                    a.notes,
                    p.first_name AS patient_first, 
                    p.last_name AS patient_last,
                    d.first_name AS doctor_first, 
                    d.last_name AS doctor_last,
                    d.specialization
                  FROM appointments a
                  JOIN patients p ON a.patient_id = p.id
                  JOIN doctors d ON a.doctor_id = d.id
                  ORDER BY a.appointment_date DESC";
                  
        $stmt = $this->db->prepare($query);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    /**
     * Schedule a new appointment.
     * 
     * @param array $data
     * @return int Inserted ID
     * @throws Exception
     */
    public function create(array $data): int {
        $patientId = (int)($data['patient_id'] ?? 0);
        $doctorId = (int)($data['doctor_id'] ?? 0);
        $date = trim($data['appointment_date'] ?? '');
        $status = trim($data['status'] ?? 'Pending');
        $notes = trim($data['notes'] ?? '');

        if ($patientId <= 0 || $doctorId <= 0 || empty($date)) {
            throw new Exception("Patient, Doctor, and Appointment Date are required.");
        }

        // Validate state
        if (!in_array($status, ['Pending', 'Confirmed', 'Cancelled', 'Completed'])) {
            $status = 'Pending';
        }

        // Verify patient exists
        $pStmt = $this->db->prepare("SELECT id FROM patients WHERE id = :id");
        $pStmt->execute(['id' => $patientId]);
        if (!$pStmt->fetch()) {
            throw new Exception("Selected patient does not exist.");
        }

        // Verify doctor exists
        $dStmt = $this->db->prepare("SELECT id FROM doctors WHERE id = :id");
        $dStmt->execute(['id' => $doctorId]);
        if (!$dStmt->fetch()) {
            throw new Exception("Selected doctor does not exist.");
        }

        $query = "INSERT INTO appointments (patient_id, doctor_id, appointment_date, status, notes) 
                  VALUES (:patient_id, :doctor_id, :appointment_date, :status, :notes)";
                  
        $stmt = $this->db->prepare($query);
        $stmt->execute([
            'patient_id' => $patientId,
            'doctor_id' => $doctorId,
            'appointment_date' => $date,
            'status' => $status,
            'notes' => $notes
        ]);

        return (int)$this->db->lastInsertId();
    }

    /**
     * Update an appointment status.
     * 
     * @param int $id
     * @param string $status
     * @return bool
     * @throws Exception
     */
    public function updateStatus(int $id, string $status): bool {
        if (!in_array($status, ['Pending', 'Confirmed', 'Cancelled', 'Completed'])) {
            throw new Exception("Invalid status value.");
        }

        $query = "UPDATE appointments SET status = :status WHERE id = :id";
        $stmt = $this->db->prepare($query);
        return $stmt->execute([
            'status' => $status,
            'id' => $id
        ]);
    }
}
