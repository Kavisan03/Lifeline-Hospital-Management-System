<?php
// src/Models/Patient.php

require_once __DIR__ . '/Database.php';

class Patient {
    private PDO $db;

    public function __construct() {
        $this->db = (new Database())->getConnection();
    }

    /**
     * Fetch all patients ordered by insertion order.
     * 
     * @return array
     */
    public function getAll(): array {
        $stmt = $this->db->prepare("SELECT id, first_name, last_name, email, phone, date_of_birth, gender, created_at FROM patients ORDER BY id DESC");
        $stmt->execute();
        return $stmt->fetchAll();
    }

    /**
     * Create a new patient record.
     * 
     * @param array $data
     * @return int Inserted ID
     * @throws Exception
     */
    public function create(array $data): int {
        // Validate inputs
        $firstName = trim($data['first_name'] ?? '');
        $lastName = trim($data['last_name'] ?? '');
        $email = trim($data['email'] ?? '');
        $phone = trim($data['phone'] ?? '');
        $dob = trim($data['date_of_birth'] ?? '');
        $gender = trim($data['gender'] ?? '');

        if (empty($firstName) || empty($lastName) || empty($email) || empty($phone) || empty($dob) || empty($gender)) {
            throw new Exception("All patient fields are required.");
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new Exception("Invalid email format.");
        }

        // Validate gender ENUM
        if (!in_array($gender, ['Male', 'Female', 'Other'])) {
            throw new Exception("Invalid value for gender.");
        }

        // Check if email already exists
        $checkStmt = $this->db->prepare("SELECT id FROM patients WHERE email = :email");
        $checkStmt->execute(['email' => $email]);
        if ($checkStmt->fetch()) {
            throw new Exception("A patient with this email already exists.");
        }

        $query = "INSERT INTO patients (first_name, last_name, email, phone, date_of_birth, gender) 
                  VALUES (:first_name, :last_name, :email, :phone, :date_of_birth, :gender)";
        
        $stmt = $this->db->prepare($query);
        $stmt->execute([
            'first_name' => $firstName,
            'last_name' => $lastName,
            'email' => $email,
            'phone' => $phone,
            'date_of_birth' => $dob,
            'gender' => $gender
        ]);

        return (int)$this->db->lastInsertId();
    }
}
