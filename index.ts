import { readFileSync, writeFileSync } from 'fs';
import { SegmentType, SegmentHeader, CompositionState, CompositionObject, PresentationCompositionSegment, WindowDefinitionSegment, PaletteDefinitionSegment, ObjectDefinitionSegment, LastInSequenceFlag, DisplaySet, PaletteEntry, Window } from './pgsTypes';
import { basename } from 'path';

function uint8Reader(buffer: Buffer, offset: number = 0): IReaderResponse<number> {
  return {
    value: buffer.readUInt8(offset),
    offset: 1,
  };
}
function uint16BEReader(buffer: Buffer, offset: number = 0): IReaderResponse<number> {
  return {
    value: buffer.readUInt16BE(offset),
    offset: 2,
  };
}
function uint24BEReader(buffer: Buffer, offset: number = 0): IReaderResponse<number> {
  return {
    value: buffer.readUIntBE(offset, 3),
    offset: 3,
  };
}
function uint32BEReader(buffer: Buffer, offset: number = 0): IReaderResponse<number> {
  return {
    value: buffer.readUInt32BE(offset),
    offset: 4,
  };
}

interface IReaderResponse<ValueType> { value: ValueType, offset: number }
function magicNumberReader(buffer: Buffer, offset: number = 0): IReaderResponse<'PG'> | null {
  const char1 = String.fromCharCode(uint8Reader(buffer, offset).value);
  const char2 = String.fromCharCode(uint8Reader(buffer, offset + 1).value);
  if (char1 === 'P' && char2 === 'G') return { value: 'PG', offset: 2 };
  return null;
}
function segmentTypeReader(buffer: Buffer, offset: number = 0): IReaderResponse<SegmentType> | null {
  const { value: rawSegmentType, offset: newOffset } = uint8Reader(buffer, offset);
  switch(rawSegmentType) {
    default:
      return null;
    case SegmentType.PDS:
      return { value: SegmentType.PDS, offset: newOffset };
    case SegmentType.ODS:
      return { value: SegmentType.ODS, offset: newOffset };
    case SegmentType.PCS:
      return { value: SegmentType.PCS, offset: newOffset };
    case SegmentType.WDS:
      return { value: SegmentType.WDS, offset: newOffset };
    case SegmentType.END:
      return { value: SegmentType.END, offset: newOffset };
  }
}
function segmentHeaderReader(buffer: Buffer, offset: number = 0): IReaderResponse<SegmentHeader> | null {
  const result = magicNumberReader(buffer, offset);
  let newOffset = offset;
  if (result && result.value === 'PG') {
    newOffset += result.offset;
    const ptsResult = uint32BEReader(buffer, newOffset);
    newOffset += ptsResult.offset;
    const dtsResult = uint32BEReader(buffer, newOffset);
    newOffset += dtsResult.offset;
    const segmentType = segmentTypeReader(buffer, newOffset);
    newOffset += segmentType.offset;
    const segmentSize = uint16BEReader(buffer, newOffset);
    newOffset += segmentSize.offset;

    return {
      value: {
        MagicNumber: 'PG',
        PTS: ptsResult.value,
        DTS: dtsResult.value,
        SegmentType: segmentType.value,
        SegmentSize: segmentSize.value,
      },
      offset: newOffset - offset,
    };
  }
}

function compositionNumberStateReader(buffer: Buffer, offset: number = 0): IReaderResponse<CompositionState> | null {
  const { value: rawCompositionState, offset: newOffset } = uint8Reader(buffer, offset);
  switch(rawCompositionState) {
    default:
      return null;
    case CompositionState.EpochStart:
      return { value: CompositionState.EpochStart, offset: newOffset };
    case CompositionState.AcquisitionPoint:
      return { value: CompositionState.AcquisitionPoint, offset: newOffset };
    case CompositionState.Normal:
      return { value: CompositionState.Normal, offset: newOffset };
  }
}
function paletteUpdateFlagReader(buffer: Buffer, offset: number = 0): IReaderResponse<boolean> | null {
  const { value: rawPaletteUpdateFlag, offset: newOffset } = uint8Reader(buffer, offset);
  if (rawPaletteUpdateFlag === 0x80) return { value: true, offset: newOffset };
  if (rawPaletteUpdateFlag === 0x00) return { value: false, offset: newOffset };
  return null;
}
function objectCroppedFlagReader(buffer: Buffer, offset: number = 0): IReaderResponse<boolean> | null {
  const { value: rawObjectCroppedFlag, offset: newOffset } = uint8Reader(buffer, offset);
  if (rawObjectCroppedFlag === 0x40) return { value: true, offset: newOffset };
  if (rawObjectCroppedFlag === 0x00) return { value: false, offset: newOffset };
  return null;
}
function compositionObjectReader(buffer: Buffer, offset: number = 0): IReaderResponse<CompositionObject> | null {
  const objectIdResult = uint16BEReader(buffer, offset);
  let newOffset = offset + objectIdResult.offset;
  const windowIdResult = uint8Reader(buffer, newOffset);
  newOffset += windowIdResult.offset;
  const objectCroppedFlagResult = objectCroppedFlagReader(buffer, newOffset);
  newOffset += objectCroppedFlagResult.offset;
  const objectHorizontalPositionResult = uint16BEReader(buffer, newOffset);
  newOffset += objectHorizontalPositionResult.offset;
  const objectVerticalPositionResult = uint16BEReader(buffer, newOffset);
  newOffset += objectVerticalPositionResult.offset;
  // determine following byte is magic number or object cropping horizontal position
  const magicNumberResult = magicNumberReader(buffer, newOffset);
  if (magicNumberResult) objectCroppedFlagResult.value = false;
  
  if (!objectCroppedFlagResult.value) {
    return {
      value: {
        ObjectID: objectIdResult.value,
        WindowID: windowIdResult.value,
        ObjectCroppedFlag: objectCroppedFlagResult.value,
        ObjectHorizontalPosition: objectHorizontalPositionResult.value,
        ObjectVerticalPosition: objectVerticalPositionResult.value,
      },
      offset: newOffset - offset,
    };
  }
  else {
    // continue reading object cropping values
    const horizontalPositionResult = uint16BEReader(buffer, newOffset);
    newOffset += horizontalPositionResult.offset;
    const verticalPositionResult = uint16BEReader(buffer, newOffset);
    newOffset += verticalPositionResult.offset;
    const width = uint16BEReader(buffer, newOffset);
    newOffset += width.offset;
    const height = uint16BEReader(buffer, newOffset);
    newOffset += height.offset;

    return {
      value: {
        ObjectID: objectIdResult.value,
        WindowID: windowIdResult.value,
        ObjectCroppedFlag: objectCroppedFlagResult.value,
        ObjectHorizontalPosition: objectHorizontalPositionResult.value,
        ObjectVerticalPosition: objectVerticalPositionResult.value,
        Cropping: {
          ObjectCroppingHorizontalPosition: horizontalPositionResult.value,
          ObjectCroppingVerticalPosition: verticalPositionResult.value,
          ObjectCroppingWidth: width.value,
          ObjectCroppingHeight: height.value,
        },
      },
      offset: newOffset - offset,
    };
  }
}
function presentationCompositionSegmentReader(buffer: Buffer, offset: number = 0): IReaderResponse<PresentationCompositionSegment> | null {
  const widthResult = uint16BEReader(buffer, offset);
  let newOffset = offset + widthResult.offset;
  const heightResult = uint16BEReader(buffer, newOffset);
  newOffset += heightResult.offset;
  const frameRateResult = uint8Reader(buffer, newOffset);
  newOffset += frameRateResult.offset;
  const compositionNumberResult = uint16BEReader(buffer, newOffset);
  newOffset += compositionNumberResult.offset;
  const compositionStateResult = compositionNumberStateReader(buffer, newOffset);
  newOffset += compositionStateResult.offset;
  const paletteUpdateFlagResult = paletteUpdateFlagReader(buffer, newOffset);
  newOffset += paletteUpdateFlagResult.offset;
  const paletteIdResult = uint8Reader(buffer, newOffset);
  newOffset += paletteIdResult.offset
  const numberOfCompositionObjectResult = uint8Reader(buffer, newOffset);
  newOffset += numberOfCompositionObjectResult.offset;
  const compositionObjects: CompositionObject[] = [];
  for (let i = 0; i < numberOfCompositionObjectResult.value; i++) {
    const compositionObjectResult = compositionObjectReader(buffer, newOffset);
    compositionObjects.push(compositionObjectResult.value);
    newOffset += compositionObjectResult.offset;
    // whether following 2 bytes are magic number
    const magicNumberResult = magicNumberReader(buffer, newOffset);
    if (magicNumberResult) break;
  }

  return {
    value: {
      Width: widthResult.value,
      Height: heightResult.value,
      FrameRate: frameRateResult.value,
      CompositionNumber: compositionNumberResult.value,
      CompositionState: compositionStateResult.value,
      PaletteUpdateFlag: paletteUpdateFlagResult.value,
      PaletteID: paletteIdResult.value,
      NumberOfCompositionObjects: numberOfCompositionObjectResult.value,
      CompositionObjects: compositionObjects,
    },
    offset: newOffset - offset,
  };
}

function windowDefinitionSegmentReader(buffer: Buffer, offset: number = 0): IReaderResponse<WindowDefinitionSegment> | null {
  const numberOfWindows = uint8Reader(buffer, offset);
  let newOffset = offset + numberOfWindows.offset;
  const windows: Window[] = [];
  while (!magicNumberReader(buffer, newOffset)) {
    const windowIdResult = uint8Reader(buffer, offset);
    newOffset += windowIdResult.offset;
    const windowHorizontalPositionResult = uint16BEReader(buffer, newOffset);
    newOffset += windowHorizontalPositionResult.offset;
    const windowVerticalPositionResult = uint16BEReader(buffer, newOffset);
    newOffset += windowVerticalPositionResult.offset;
    const windowWidthResult = uint16BEReader(buffer, newOffset);
    newOffset += windowWidthResult.offset;
    const windowHeightResult = uint16BEReader(buffer, newOffset);
    newOffset += windowHeightResult.offset;
    windows.push({
      WindowID: windowIdResult.value,
      WindowHorizontalPosition: windowHorizontalPositionResult.value,
      WindowVerticalPosition: windowVerticalPositionResult.value,
      WindowWidth: windowWidthResult.value,
      WindowHeight: windowHeightResult.value,
    });
  }

  return {
    value: {
      NumberOfWindows: numberOfWindows.value,
      Windows: windows,
    },
    offset: newOffset - offset,
  };
}

function paletteDefinitionSegmentReader(buffer: Buffer, offset: number = 0): IReaderResponse<PaletteDefinitionSegment> | null {
  const paletteIdResult = uint8Reader(buffer, offset);
  let newOffset = offset + paletteIdResult.offset;
  const paletteVersionNumberResult = uint8Reader(buffer, newOffset);
  newOffset += paletteVersionNumberResult.offset;
  const entries: PaletteEntry[] = [];
  while (!magicNumberReader(buffer, newOffset)) {
    const paletteEntryIdResult = uint8Reader(buffer, newOffset);
    newOffset += paletteEntryIdResult.offset;
    const luminanceResult = uint8Reader(buffer, newOffset);
    newOffset += luminanceResult.offset;
    const colorDifferenceRedResult = uint8Reader(buffer, newOffset);
    newOffset += colorDifferenceRedResult.offset;
    const colorDifferenceBlueResult = uint8Reader(buffer, newOffset);
    newOffset += colorDifferenceBlueResult.offset;
    const transparencyResult = uint8Reader(buffer, newOffset);
    newOffset += transparencyResult.offset;
    entries.push({
      PaletteEntryID: paletteEntryIdResult.value,
      Luminance: luminanceResult.value,
      ColorDifferenceRed: colorDifferenceRedResult.value,
      ColorDifferenceBlue: colorDifferenceBlueResult.value,
      Transparency: transparencyResult.value,
    });
  };

  return {
    value: {
      PaletteID: paletteIdResult.value,
      PaletteVersionNumber: paletteVersionNumberResult.value,
      PaletteEntries: entries,
    },
    offset: newOffset - offset,
  };
}

function lastInSequenceFlagReader(buffer: Buffer, offset: number = 0): IReaderResponse<LastInSequenceFlag> | null {
  const { value: rawLastInSequenceFlag, offset: newOffset } = uint8Reader(buffer, offset);
  switch(rawLastInSequenceFlag) {
    default:
      return null;
    case LastInSequenceFlag.Last:
      return { value: LastInSequenceFlag.Last, offset: newOffset };
    case LastInSequenceFlag.First:
      return { value: LastInSequenceFlag.First, offset: newOffset };
    case LastInSequenceFlag.FirstAndLast:
      return { value: LastInSequenceFlag.FirstAndLast, offset: newOffset };
  }
}
function objectDefinitionSegmentReader(buffer: Buffer, offset: number = 0, size?: number): IReaderResponse<ObjectDefinitionSegment> | null {
  const objectIdResult = uint16BEReader(buffer, offset);
  let newOffset = offset + objectIdResult.offset;
  const objectVersionNumberResult = uint8Reader(buffer, newOffset);
  newOffset += objectVersionNumberResult.offset;
  const lastInSequenceFlagResult = lastInSequenceFlagReader(buffer, newOffset);
  newOffset += lastInSequenceFlagResult.offset;
  const objectDataLengthResult = uint24BEReader(buffer, newOffset);
  newOffset += objectDataLengthResult.offset;
  const widthResult = uint16BEReader(buffer, newOffset);
  newOffset += widthResult.offset;
  const heightResult = uint16BEReader(buffer, newOffset);
  newOffset += heightResult.offset;
  if (size) objectDataLengthResult.value = size - (newOffset - offset);
  const objectDataResult = buffer.slice(newOffset, newOffset + objectDataLengthResult.value);
  newOffset += objectDataLengthResult.value;
  return {
    value: {
      ObjectID: objectIdResult.value,
      ObjectVersionNumber: objectVersionNumberResult.value,
      LastInSequenceFlag: lastInSequenceFlagResult.value,
      ObjectDataLength: objectDataLengthResult.value,
      Width: widthResult.value,
      Height: heightResult.value,
      ObjectData: objectDataResult,
    },
    offset: newOffset - offset,
  };
}

function displaySetReader(buffer: Buffer, offset: number = 0): IReaderResponse<DisplaySet> | null {
  const pcsHeaderResult = segmentHeaderReader(buffer, offset);
  if (pcsHeaderResult && pcsHeaderResult.value.SegmentType === SegmentType.PCS) {
    let newOffset = offset + pcsHeaderResult.offset;
    const pcsBodyResult = presentationCompositionSegmentReader(buffer, newOffset);
    newOffset += pcsBodyResult.offset;
    const wdses: (SegmentHeader & WindowDefinitionSegment)[] = [];
    const pdses: (SegmentHeader & PaletteDefinitionSegment)[] = [];
    const odses: (SegmentHeader & ObjectDefinitionSegment)[] = [];
    let segmentHeader: SegmentHeader | null;
    let segmentBody: WindowDefinitionSegment | PaletteDefinitionSegment | ObjectDefinitionSegment | null;
    do {
      const headerResult = segmentHeaderReader(buffer, newOffset);
      if (headerResult) {
        segmentHeader = headerResult.value;
        newOffset += headerResult.offset;
        switch (headerResult.value.SegmentType) {
          case SegmentType.WDS: {
            const wdsResult = windowDefinitionSegmentReader(buffer, newOffset);
            if (wdsResult) {
              segmentBody = wdsResult.value;
              wdses.push({ ...segmentHeader, ...segmentBody });
              newOffset += wdsResult.offset;
            }
            break;
          }
          case SegmentType.PDS: {
            const pdsResult = paletteDefinitionSegmentReader(buffer, newOffset);
            if (pdsResult) {
              segmentBody = pdsResult.value;
              pdses.push({ ...segmentHeader, ...segmentBody });
              newOffset += pdsResult.offset;
            }
            break;
          }
          case SegmentType.ODS: {
            const odsResult = objectDefinitionSegmentReader(buffer, newOffset, segmentHeader.SegmentSize);
            if (odsResult) {
              segmentBody = odsResult.value;
              odses.push({ ...segmentHeader, ...segmentBody });
              newOffset += odsResult.offset;
            }
            break;
          }
          case SegmentType.END: {
            break;
          }
        }
      } else break;
    } while(segmentHeader && segmentHeader.SegmentType !== SegmentType.END && segmentBody);

    return {
      value: {
        pcs: { ...pcsHeaderResult.value, ...pcsBodyResult.value },
        wds: wdses,
        pds: pdses,
        ods: odses,
      },
      offset: newOffset - offset,
    };
  }
}

function pgsReader(path: string) {
  const buffer = readFileSync(path);
  console.log('File Readed! Length:', buffer.byteLength);
  let newOffset = 0;
  const result = [];
  while (newOffset !== buffer.byteLength) {
    const displaySetResult = displaySetReader(buffer, newOffset);
    if (displaySetResult.offset) {
      result.push(displaySetResult.value);
      newOffset += displaySetResult.offset;
      console.log('Current Offset:', newOffset);
    } else break;
  }
  writeFileSync(`./${basename(path, 'sup')}json`, JSON.stringify(result, null, 2));
}

pgsReader('./assets/embedded.sup');
