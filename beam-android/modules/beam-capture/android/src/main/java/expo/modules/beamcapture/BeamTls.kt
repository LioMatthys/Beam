package expo.modules.beamcapture

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.math.BigInteger
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import javax.net.ssl.KeyManagerFactory
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLServerSocketFactory
import javax.security.auth.x500.X500Principal

/**
 * TLS for the Beam control + video link. The phone generates a self-signed RSA cert
 * ONCE in the AndroidKeyStore (which auto-creates the X.509 cert, so we need no
 * BouncyCastle dependency) and reuses it across sessions. The PC pins this cert's
 * fingerprint on first pair (trust-on-first-use), so a swapped cert is detected.
 *
 * This encrypts the wire; the 6-digit pairing code (sent inside TLS) still authorizes
 * the PC. Full PAKE is a later step; this closes the plaintext-on-the-LAN hole.
 */
object BeamTls {
  private const val ALIAS = "beam_tls_key_v3"
  private const val ANDROID_KEYSTORE = "AndroidKeyStore"

  /** SSL server socket factory backed by the device's persistent self-signed cert. */
  fun serverSocketFactory(): SSLServerSocketFactory {
    ensureKeyPair()
    val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
    val kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm())
    kmf.init(keyStore, null) // AndroidKeyStore private keys take no password
    val ctx = SSLContext.getInstance("TLS")
    ctx.init(kmf.keyManagers, null, null)
    return ctx.serverSocketFactory
  }

  /** Lowercase hex SHA-256 of the cert (DER), the value the PC pins. */
  fun certFingerprintSha256(): String {
    ensureKeyPair()
    val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
    val cert = keyStore.getCertificate(ALIAS)
    val digest = MessageDigest.getInstance("SHA-256").digest(cert.encoded)
    return digest.joinToString(":") { "%02x".format(it) }
  }

  private fun ensureKeyPair() {
    val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
    if (keyStore.containsAlias(ALIAS)) return
    val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_RSA, ANDROID_KEYSTORE)
    // PURPOSE_SIGN covers ECDHE_RSA cipher suites; PURPOSE_DECRYPT covers RSA key transport.
    val spec = KeyGenParameterSpec.Builder(
      ALIAS,
      KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_DECRYPT
    )
      .setKeySize(2048)
      // Conscrypt's TLS RSA signing does a RAW private-key op via Cipher (NoPadding, no
      // digest) and applies PKCS1/PSS itself — so the key must allow DIGEST_NONE and
      // ENCRYPTION_PADDING_NONE, or the keystore rejects it (INCOMPATIBLE_PADDING_MODE).
      .setDigests(KeyProperties.DIGEST_NONE, KeyProperties.DIGEST_SHA256, KeyProperties.DIGEST_SHA1)
      .setSignaturePaddings(
        KeyProperties.SIGNATURE_PADDING_RSA_PKCS1,
        KeyProperties.SIGNATURE_PADDING_RSA_PSS
      )
      .setEncryptionPaddings(
        KeyProperties.ENCRYPTION_PADDING_NONE,
        KeyProperties.ENCRYPTION_PADDING_RSA_PKCS1
      )
      .setCertificateSubject(X500Principal("CN=Beam"))
      .setCertificateSerialNumber(BigInteger.valueOf(1L))
      .build()
    generator.initialize(spec)
    generator.generateKeyPair()
  }
}
