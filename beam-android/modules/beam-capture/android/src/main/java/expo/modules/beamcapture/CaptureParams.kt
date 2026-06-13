package expo.modules.beamcapture

import android.os.Parcel
import android.os.Parcelable

/** Resolved capture settings, computed in the module and passed to the service. */
data class CaptureParams(
  val width: Int,
  val height: Int,
  val bitrate: Int,
  val fps: Int,
  val port: Int,
  val code: String,
  /** Physical display size + rotation, sent in HELLO so the PC can map control taps. */
  val physWidth: Int,
  val physHeight: Int,
  val rotation: Int
) : Parcelable {
  constructor(p: Parcel) : this(
    p.readInt(), p.readInt(), p.readInt(), p.readInt(), p.readInt(), p.readString() ?: "",
    p.readInt(), p.readInt(), p.readInt()
  )

  override fun writeToParcel(p: Parcel, flags: Int) {
    p.writeInt(width); p.writeInt(height); p.writeInt(bitrate)
    p.writeInt(fps); p.writeInt(port); p.writeString(code)
    p.writeInt(physWidth); p.writeInt(physHeight); p.writeInt(rotation)
  }

  override fun describeContents() = 0

  companion object CREATOR : Parcelable.Creator<CaptureParams> {
    override fun createFromParcel(p: Parcel) = CaptureParams(p)
    override fun newArray(size: Int) = arrayOfNulls<CaptureParams>(size)
  }
}
