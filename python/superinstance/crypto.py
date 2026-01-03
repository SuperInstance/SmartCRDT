"""
High-level cryptographic utilities for Python.

Provides convenient wrappers for hashing, encryption, and key derivation.
"""

from typing import Optional
import os

try:
    from .superinstance import (
        HashAlgorithm,
        hash as _hash,
        hash_blake3 as _hash_blake3,
        hash_sha256 as _hash_sha256,
        encrypt as _encrypt,
        decrypt as _decrypt,
        derive_key as _derive_key,
        secure_random as _secure_random,
    )
except ImportError:
    raise ImportError(
        "Native module not found. Please build the Rust extension first."
    )


class CryptoUtils:
    """
    Utility functions for cryptographic operations.

    Example:
        >>> utils = CryptoUtils()
        >>> hash_value = utils.hash(b"Hello, world!", algo="blake3")
        >>> print(hash_value.hex())
    """

    @staticmethod
    def hash(data: bytes, algo: str = "blake3") -> bytes:
        """
        Calculate hash of data.

        Args:
            data: Data to hash
            algo: Hash algorithm ("blake3" or "sha256", default: "blake3")

        Returns:
            Hash digest

        Example:
            >>> CryptoUtils.hash(b"Hello, world!", algo="blake3")
            b'...'
        """
        algo_enum = (
            HashAlgorithm.BLAKE3 if algo.lower() == "blake3" else HashAlgorithm.SHA256
        )
        return _hash(list(data), algo_enum)

    @staticmethod
    def hash_blake3(data: bytes) -> bytes:
        """
        Calculate BLAKE3 hash (fastest).

        Args:
            data: Data to hash

        Returns:
            32-byte hash digest

        Example:
            >>> CryptoUtils.hash_blake3(b"Hello, world!")
            b'...'
        """
        return _hash_blake3(list(data))

    @staticmethod
    def hash_sha256(data: bytes) -> bytes:
        """
        Calculate SHA256 hash.

        Args:
            data: Data to hash

        Returns:
            32-byte hash digest

        Example:
            >>> CryptoUtils.hash_sha256(b"Hello, world!")
            b'...'
        """
        return _hash_sha256(list(data))

    @staticmethod
    def encrypt(plaintext: bytes, key: bytes, nonce: Optional[bytes] = None) -> tuple[bytes, bytes]:
        """
        Encrypt data using ChaCha20-Poly1305.

        Args:
            plaintext: Data to encrypt
            key: Encryption key (32 bytes)
            nonce: Nonce (12 bytes, generated if not provided)

        Returns:
            (ciphertext, nonce) tuple

        Example:
            >>> plaintext = b"Secret message"
            >>> key = os.urandom(32)
            >>> ciphertext, nonce = CryptoUtils.encrypt(plaintext, key)
        """
        if len(key) != 32:
            raise ValueError("Key must be 32 bytes")

        if nonce is None:
            nonce = CryptoUtils.generate_nonce()

        if len(nonce) != 12:
            raise ValueError("Nonce must be 12 bytes")

        ciphertext = _encrypt(list(plaintext), list(key), list(nonce))
        return bytes(ciphertext), nonce

    @staticmethod
    def decrypt(ciphertext: bytes, key: bytes, nonce: bytes) -> bytes:
        """
        Decrypt data using ChaCha20-Poly1305.

        Args:
            ciphertext: Data to decrypt
            key: Decryption key (32 bytes)
            nonce: Nonce used for encryption (12 bytes)

        Returns:
            Decrypted plaintext

        Example:
            >>> plaintext = CryptoUtils.decrypt(ciphertext, key, nonce)
        """
        if len(key) != 32:
            raise ValueError("Key must be 32 bytes")

        if len(nonce) != 12:
            raise ValueError("Nonce must be 12 bytes")

        plaintext = _decrypt(list(ciphertext), list(key), list(nonce))
        return bytes(plaintext)

    @staticmethod
    def derive_key(
        password: bytes, salt: Optional[bytes] = None, length: int = 32
    ) -> tuple[bytes, bytes]:
        """
        Derive a key from password using Argon2.

        Args:
            password: Password to derive from
            salt: Salt for key derivation (generated if not provided)
            length: Desired key length in bytes (16-64, default: 32)

        Returns:
            (key, salt) tuple

        Example:
            >>> password = b"my_secure_password"
            >>> key, salt = CryptoUtils.derive_key(password)
            >>> print(f"Key: {key.hex()}")
        """
        if not 16 <= length <= 64:
            raise ValueError("Key length must be between 16 and 64 bytes")

        if salt is None:
            salt = CryptoUtils.generate_salt()

        key = _derive_key(list(password), list(salt), length)
        return bytes(key), salt

    @staticmethod
    def secure_random(length: int) -> bytes:
        """
        Generate cryptographically secure random bytes.

        Args:
            length: Number of bytes to generate

        Returns:
            Random bytes

        Example:
            >>> random_bytes = CryptoUtils.secure_random(32)
        """
        return bytes(_secure_random(length))

    @staticmethod
    def generate_key() -> bytes:
        """Generate a random 32-byte encryption key."""
        return CryptoUtils.secure_random(32)

    @staticmethod
    def generate_nonce() -> bytes:
        """Generate a random 12-byte nonce."""
        return CryptoUtils.secure_random(12)

    @staticmethod
    def generate_salt() -> bytes:
        """Generate a random 16-byte salt."""
        return CryptoUtils.secure_random(16)

    @staticmethod
    def hash_file(path: str, algo: str = "blake3") -> bytes:
        """
        Calculate hash of a file.

        Args:
            path: Path to file
            algo: Hash algorithm ("blake3" or "sha256")

        Returns:
            Hash digest

        Example:
            >>> hash_value = CryptoUtils.hash_file("document.pdf")
            >>> print(hash_value.hex())
        """
        hasher = (
            CryptoUtils.hash_blake3 if algo.lower() == "blake3" else CryptoUtils.hash_sha256
        )

        with open(path, "rb") as f:
            # Read file in chunks
            chunk_size = 8192
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                # For simplicity, hash entire file at once
                # For large files, consider incremental hashing
                if len(chunk) == chunk_size or f.tell() == os.path.getsize(path):
                    return hasher(chunk)

        # Fallback for small files
        with open(path, "rb") as f:
            return hasher(f.read())


class SecureBox:
    """
    Secure box for encrypting/decrypting data with password-based encryption.

    Uses Argon2 for key derivation and ChaCha20-Poly1305 for encryption.

    Args:
        password: Password for encryption/decryption

    Example:
        >>> box = SecureBox(b"my_password")
        >>> encrypted = box.encrypt(b"Secret data")
        >>> decrypted = box.decrypt(encrypted)
        >>> assert decrypted == b"Secret data"
    """

    def __init__(self, password: bytes):
        if not password:
            raise ValueError("Password cannot be empty")

        self.password = password

    def encrypt(self, plaintext: bytes) -> bytes:
        """
        Encrypt data with password.

        Args:
            plaintext: Data to encrypt

        Returns:
            Encrypted data (includes salt and nonce)

        Example:
            >>> encrypted = box.encrypt(b"Secret message")
        """
        # Derive key from password
        key, salt = CryptoUtils.derive_key(self.password)

        # Generate nonce
        nonce = CryptoUtils.generate_nonce()

        # Encrypt
        ciphertext, _ = CryptoUtils.encrypt(plaintext, key, nonce)

        # Return salt + nonce + ciphertext
        return salt + nonce + ciphertext

    def decrypt(self, data: bytes) -> bytes:
        """
        Decrypt data with password.

        Args:
            data: Encrypted data (salt + nonce + ciphertext)

        Returns:
            Decrypted plaintext

        Example:
            >>> decrypted = box.decrypt(encrypted)
        """
        if len(data) < 28:  # 16 bytes salt + 12 bytes nonce
            raise ValueError("Invalid encrypted data")

        # Extract salt, nonce, and ciphertext
        salt = data[:16]
        nonce = data[16:28]
        ciphertext = data[28:]

        # Derive key from password and salt
        key, _ = CryptoUtils.derive_key(self.password, salt)

        # Decrypt
        return CryptoUtils.decrypt(ciphertext, key, nonce)


# Convenience functions
def hash(data: bytes, algo: str = "blake3") -> bytes:
    """Calculate hash of data."""
    return CryptoUtils.hash(data, algo)


def encrypt(plaintext: bytes, key: bytes) -> tuple[bytes, bytes]:
    """Encrypt data using ChaCha20-Poly1305."""
    return CryptoUtils.encrypt(plaintext, key)


def decrypt(ciphertext: bytes, key: bytes, nonce: bytes) -> bytes:
    """Decrypt data using ChaCha20-Poly1305."""
    return CryptoUtils.decrypt(ciphertext, key, nonce)


def derive_key(password: bytes, salt: Optional[bytes] = None) -> tuple[bytes, bytes]:
    """Derive a key from password using Argon2."""
    return CryptoUtils.derive_key(password, salt)


def secure_random(length: int) -> bytes:
    """Generate cryptographically secure random bytes."""
    return CryptoUtils.secure_random(length)


def demo_crypto():
    """Demonstrate cryptographic operations."""
    print("=== Cryptographic Operations Demo ===\n")

    # Hashing
    print("1. Hashing")
    data = b"Hello, world!"
    blake3_hash = CryptoUtils.hash_blake3(data)
    sha256_hash = CryptoUtils.hash_sha256(data)
    print(f"   BLAKE3: {blake3_hash.hex()}")
    print(f"   SHA256: {sha256_hash.hex()}")
    print()

    # Encryption
    print("2. Encryption (ChaCha20-Poly1305)")
    plaintext = b"Secret message"
    key = CryptoUtils.generate_key()
    ciphertext, nonce = CryptoUtils.encrypt(plaintext, key)
    decrypted = CryptoUtils.decrypt(ciphertext, key, nonce)
    print(f"   Plaintext: {plaintext}")
    print(f"   Ciphertext: {ciphertext.hex()[:32]}...")
    print(f"   Decrypted: {decrypted}")
    print()

    # Password-based encryption
    print("3. Password-Based Encryption")
    box = SecureBox(b"my_secure_password")
    encrypted = box.encrypt(b"Secret data")
    decrypted = box.decrypt(encrypted)
    print(f"   Original: b'Secret data'")
    print(f"   Decrypted: {decrypted}")
    print()

    # Key derivation
    print("4. Key Derivation (Argon2)")
    password = b"my_password"
    key, salt = CryptoUtils.derive_key(password)
    print(f"   Password: {password.decode()}")
    print(f"   Derived key: {key.hex()}")
    print(f"   Salt: {salt.hex()}")
    print()


if __name__ == "__main__":
    demo_crypto()
