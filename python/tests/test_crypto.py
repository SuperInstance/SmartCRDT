"""
Tests for cryptographic utilities.
"""

import pytest
import sys
sys.path.insert(0, '../')

from superinstance import CryptoUtils, SecureBox, HashAlgorithm


class TestHashing:
    """Test hash functions."""

    def test_hash_blake3(self):
        """Test BLAKE3 hashing."""
        data = b"Hello, world!"
        hash_value = CryptoUtils.hash_blake3(data)

        # BLAKE3 produces 32-byte hash
        assert len(hash_value) == 32
        assert isinstance(hash_value, bytes)

    def test_hash_sha256(self):
        """Test SHA256 hashing."""
        data = b"Hello, world!"
        hash_value = CryptoUtils.hash_sha256(data)

        # SHA256 produces 32-byte hash
        assert len(hash_value) == 32
        assert isinstance(hash_value, bytes)

    def test_hash_generic(self):
        """Test generic hash function."""
        data = b"Hello, world!"

        blake3_hash = CryptoUtils.hash(data, algo="blake3")
        sha256_hash = CryptoUtils.hash(data, algo="sha256")

        assert len(blake3_hash) == 32
        assert len(sha256_hash) == 32

        # Different algorithms produce different hashes
        assert blake3_hash != sha256_hash

    def test_hash_deterministic(self):
        """Test that hashing is deterministic."""
        data = b"Test data"

        hash1 = CryptoUtils.hash_blake3(data)
        hash2 = CryptoUtils.hash_blake3(data)

        assert hash1 == hash2

    def test_hash_different_inputs(self):
        """Test that different inputs produce different hashes."""
        data1 = b"Data 1"
        data2 = b"Data 2"

        hash1 = CryptoUtils.hash_blake3(data1)
        hash2 = CryptoUtils.hash_blake3(data2)

        assert hash1 != hash2

    def test_hash_empty(self):
        """Test hashing empty data."""
        data = b""
        hash_value = CryptoUtils.hash_blake3(data)

        assert len(hash_value) == 32


class TestEncryption:
    """Test encryption/decryption."""

    def test_encrypt_decrypt(self):
        """Test basic encrypt/decrypt."""
        plaintext = b"Secret message"

        key = CryptoUtils.generate_key()
        ciphertext, nonce = CryptoUtils.encrypt(plaintext, key)

        # Ciphertext should be different from plaintext
        assert ciphertext != plaintext
        assert len(ciphertext) > len(plaintext)  # AEAD adds overhead

        # Decrypt
        decrypted = CryptoUtils.decrypt(ciphertext, key, nonce)
        assert decrypted == plaintext

    def test_encrypt_different_key(self):
        """Test that different key produces different ciphertext."""
        plaintext = b"Secret message"

        key1 = CryptoUtils.generate_key()
        key2 = CryptoUtils.generate_key()

        ciphertext1, nonce1 = CryptoUtils.encrypt(plaintext, key1)
        ciphertext2, nonce2 = CryptoUtils.encrypt(plaintext, key2)

        # Different keys produce different ciphertexts
        assert ciphertext1 != ciphertext2

    def test_decrypt_wrong_key(self):
        """Test that wrong key fails to decrypt."""
        plaintext = b"Secret message"

        key1 = CryptoUtils.generate_key()
        key2 = CryptoUtils.generate_key()

        ciphertext, nonce = CryptoUtils.encrypt(plaintext, key1)

        # Try to decrypt with wrong key
        # Should either raise error or produce garbage
        try:
            decrypted = CryptoUtils.decrypt(ciphertext, key2, nonce)
            # If it doesn't raise, result should be wrong
            assert decrypted != plaintext
        except (ValueError, RuntimeError):
            # Also acceptable to raise error
            pass

    def test_encrypt_key_length(self):
        """Test key length validation."""
        plaintext = b"Secret message"

        # Wrong key length
        wrong_key = b"short"

        with pytest.raises(ValueError):
            CryptoUtils.encrypt(plaintext, wrong_key)

    def test_encrypt_nonce_length(self):
        """Test nonce length validation."""
        plaintext = b"Secret message"
        key = CryptoUtils.generate_key()

        # Wrong nonce length
        wrong_nonce = b"short"

        with pytest.raises(ValueError):
            CryptoUtils.encrypt(plaintext, key, wrong_nonce)


class TestKeyDerivation:
    """Test key derivation."""

    def test_derive_key(self):
        """Test basic key derivation."""
        password = b"my_password"
        salt = CryptoUtils.generate_salt()

        key, returned_salt = CryptoUtils.derive_key(password, salt)

        # Default key length is 32 bytes
        assert len(key) == 32
        assert returned_salt == salt

    def test_derive_key_custom_length(self):
        """Test key derivation with custom length."""
        password = b"my_password"

        for length in [16, 24, 32, 64]:
            key, salt = CryptoUtils.derive_key(password, length=length)
            assert len(key) == length

    def test_derive_key_invalid_length(self):
        """Test key derivation with invalid length."""
        password = b"my_password"

        with pytest.raises(ValueError):
            CryptoUtils.derive_key(password, length=8)  # Too short

        with pytest.raises(ValueError):
            CryptoUtils.derive_key(password, length=100)  # Too long

    def test_derive_key_deterministic(self):
        """Test that key derivation is deterministic."""
        password = b"my_password"
        salt = b"my_salt"

        key1, _ = CryptoUtils.derive_key(password, salt)
        key2, _ = CryptoUtils.derive_key(password, salt)

        assert key1 == key2

    def test_derive_key_different_salts(self):
        """Test that different salts produce different keys."""
        password = b"my_password"

        key1, salt1 = CryptoUtils.derive_key(password)
        key2, salt2 = CryptoUtils.derive_key(password)

        # Different salts should produce different keys
        assert salt1 != salt2
        assert key1 != key2

    def test_derive_key_auto_salt(self):
        """Test key derivation with auto-generated salt."""
        password = b"my_password"

        key, salt = CryptoUtils.derive_key(password)

        assert len(key) == 32
        assert len(salt) == 16


class TestSecureRandom:
    """Test secure random generation."""

    def test_secure_random(self):
        """Test secure random generation."""
        random_bytes = CryptoUtils.secure_random(32)

        assert len(random_bytes) == 32
        assert isinstance(random_bytes, bytes)

    def test_secure_random_different(self):
        """Test that random calls produce different values."""
        random1 = CryptoUtils.secure_random(32)
        random2 = CryptoUtils.secure_random(32)

        assert random1 != random2

    def test_generate_key(self):
        """Test key generation."""
        key = CryptoUtils.generate_key()

        assert len(key) == 32

    def test_generate_nonce(self):
        """Test nonce generation."""
        nonce = CryptoUtils.generate_nonce()

        assert len(nonce) == 12

    def test_generate_salt(self):
        """Test salt generation."""
        salt = CryptoUtils.generate_salt()

        assert len(salt) == 16


class TestSecureBox:
    """Test SecureBox (password-based encryption)."""

    def test_encrypt_decrypt(self):
        """Test basic encrypt/decrypt with password."""
        box = SecureBox(b"my_password")

        plaintext = b"Secret data"
        encrypted = box.encrypt(plaintext)

        # Encrypted data should be different
        assert encrypted != plaintext
        assert len(encrypted) > len(plaintext)

        # Decrypt
        decrypted = box.decrypt(encrypted)
        assert decrypted == plaintext

    def test_encrypt_decrypt_different_passwords(self):
        """Test that different passwords produce different results."""
        box1 = SecureBox(b"password1")
        box2 = SecureBox(b"password2")

        plaintext = b"Secret data"

        encrypted1 = box1.encrypt(plaintext)
        encrypted2 = box2.encrypt(plaintext)

        # Different passwords produce different ciphertexts
        assert encrypted1 != encrypted2

    def test_decrypt_wrong_password(self):
        """Test that wrong password fails to decrypt."""
        box1 = SecureBox(b"password1")
        box2 = SecureBox(b"password2")

        plaintext = b"Secret data"
        encrypted = box1.encrypt(plaintext)

        # Try to decrypt with wrong password
        try:
            decrypted = box2.decrypt(encrypted)
            # If it doesn't raise, result should be wrong
            assert decrypted != plaintext
        except (ValueError, RuntimeError):
            # Also acceptable to raise error
            pass

    def test_empty_password(self):
        """Test that empty password is rejected."""
        with pytest.raises(ValueError):
            SecureBox(b"")

    def test_large_data(self):
        """Test encrypting large data."""
        box = SecureBox(b"my_password")

        # 1MB of data
        large_data = b"x" * (1024 * 1024)

        encrypted = box.encrypt(large_data)
        decrypted = box.decrypt(encrypted)

        assert decrypted == large_data


class TestCryptoEdgeCases:
    """Test edge cases."""

    def test_empty_data_hash(self):
        """Test hashing empty data."""
        hash_value = CryptoUtils.hash_blake3(b"")
        assert len(hash_value) == 32

    def test_empty_data_encrypt(self):
        """Test encrypting empty data."""
        box = SecureBox(b"password")

        encrypted = box.encrypt(b"")
        decrypted = box.decrypt(encrypted)

        assert decrypted == b""

    def test_unicode_password(self):
        """Test with Unicode password."""
        box = SecureBox("пароль".encode('utf-8'))

        plaintext = b"Secret"
        encrypted = box.encrypt(plaintext)
        decrypted = box.decrypt(encrypted)

        assert decrypted == plaintext


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
