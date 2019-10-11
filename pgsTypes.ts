export enum SegmentType {
  PDS = 0x14,
  ODS = 0x15,
  PCS = 0x16,
  WDS = 0x17,
  END = 0x80,
}
export interface SegmentHeader {
  MagicNumber: 'PG' | string;
  /** Presentation Timestamp. */
  PTS: number;
  /** Decoding Timestamp. */
  DTS: number;
  SegmentType: SegmentType;
  /** Size of the segment. */
  SegmentSize: number;
}
export enum CompositionState {
  /**
   * This defines a display update,
   * and contains only functional segments with elements that are different from the preceding composition.
   * It’s mostly used to stop displaying objects on the screen by defining a composition with no composition objects (a value of zero in the Number of Composition Objects flag)
   * but also used to define a new composition with new objects and objects defined since the Epoch Start.
   */
  Normal = 0x00,
  /**
   * This defines a display refresh.
   * This is used to compose in the middle of the Epoch.
   * It includes functional segments with new objects to be used in a new composition, replacing old objects with the same Object ID.
   */
  AcquisitionPoint = 0x40,
  /**
   * This defines a new display.
   * The Epoch Start contains all functional segments needed to display a new composition on the screen.
   */
  EpochStart = 0x80,
}
export interface PresentationCompositionSegment {
  /** Video width in pixels. */
  Width: number;
  /** Video height in pixels. */
  Height: number;
  /** Always 0x10. Can be ignored. */
  FrameRate: number;
  /**
   * Number of this specific composition.
   * It is incremented by one every time a graphics update occurs.
   */
  CompositionNumber: number;
  /** Type of this composition. */
  CompositionState: CompositionState;
  /** Indicates if this PCS describes a Palette only Display Update. */
  PaletteUpdateFlag: boolean;
  /** ID of the palette to be used in the Palette only Display Update. */
  PaletteID: number;
  /** Number of composition objects defined in this segment. */
  NumberOfCompositionObjects: number;
  CompositionObjects: CompositionObject[];
}
export interface CompositionObject {
  /** ID of the ODS segment that defines the image to be shown. */
  ObjectID: number;
  /**
   * Id of the WDS segment to which the image is allocated in the PCS.
   * Up to two images may be assigned to one window.
   */
  WindowID: number;
  /**
   * true: Force display of the cropped image object
   * false: Off
   */
  ObjectCroppedFlag: boolean;
  /** X offset from the top left pixel of the image on the screen. */
  ObjectHorizontalPosition: number;
  /** Y offset from the top left pixel of the image on the screen. */
  ObjectVerticalPosition: number;
  Cropping?: {
    /**
     * X offset from the top left pixel of the cropped object in the screen.
     * Only used when the Object Cropped Flag is set to true.
     */
    ObjectCroppingHorizontalPosition: number;
    /**
     * Y offset from the top left pixel of the cropped object in the screen.
     * Only used when the Object Cropped Flag is set to true.
     */
    ObjectCroppingVerticalPosition: number;
    /**
     * Width of the cropped object in the screen.
     * Only used when the Object Cropped Flag is set to true.
     */
    ObjectCroppingWidth: number;
    /**
     * Height of the cropped object in the screen.
     * Only used when the Object Cropped Flag is set to true.
     */
    ObjectCroppingHeight: number;
  };
}
export interface Window {
  /** ID of this window. */
  WindowID: number;
  /** X offset from the top left pixel of the window in the screen. */
  WindowHorizontalPosition: number;
  /** Y offset from the top left pixel of the window in the screen. */
  WindowVerticalPosition: number;
  /** Width of the window. */
  WindowWidth: number;
  /** Height of the window. */
  WindowHeight: number;
}
export interface WindowDefinitionSegment {
  NumberOfWindows: number;
  Windows: Window[];
}
export interface PaletteEntry {
  /** Entry number of the palette. */
  PaletteEntryID: number;
  /** Luminance (Y value). */
  Luminance: number;
  /** Color Difference Red (Cr value). */
  ColorDifferenceRed: number;
  /** Color Difference Blue (Cb value). */
  ColorDifferenceBlue: number;
  /** Transparency (Alpha value). */
  Transparency: number;
}
export interface PaletteDefinitionSegment {
  /** ID of the palette. */
  PaletteID: number;
  /** Version of this palette within the Epoch. */
  PaletteVersionNumber: number;
  /** Palette entries */
  PaletteEntries: PaletteEntry[];
}
export enum LastInSequenceFlag {
  Last = 0x40,
  First = 0x80,
  FirstAndLast = 0xC0,
}
export interface ObjectDefinitionSegment {
  /** ID of this object. */
  ObjectID: number;
  /** Version of this object. */
  ObjectVersionNumber: number;
  /** If the image is split into a series of consecutive fragments, the last fragment has this flag set. */
  LastInSequenceFlag: LastInSequenceFlag;
  /** The length of the Run-length Encoding (RLE) data buffer with the compressed image data. */
  ObjectDataLength: number;
  /** Width of the image. */
  Width: number;
  /** Height of the image. */
  Height: number;
  /**
   * This is the image data compressed using Run-length Encoding (RLE).
   * The size of the data is defined in the Object Data Length field.
   */
  ObjectData: Buffer;
}

export type DisplaySet = {
  pcs: SegmentHeader & PresentationCompositionSegment;
  wds: (SegmentHeader & WindowDefinitionSegment)[],
  pds: (SegmentHeader & PaletteDefinitionSegment)[],
  ods: (SegmentHeader & ObjectDefinitionSegment)[],
}
