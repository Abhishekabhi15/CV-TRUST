/**
 * ShiftRecord — per-image distribution shift analysis result.
 * Created automatically after every successful POST /api/detect.
 * This is the thesis "Distribution Shift" collection.
 */
const mongoose = require('mongoose');

const imageStatsSchema = new mongoose.Schema({
  width:         { type: Number },
  height:        { type: Number },
  aspectRatio:   { type: Number },
  brightness:    { type: Number },
  contrast:      { type: Number },
  rMean:         { type: Number },
  gMean:         { type: Number },
  bMean:         { type: Number },
  fileSizeBytes: { type: Number },
}, { _id: false });

const metricDetailSchema = new mongoose.Schema({
  baseline:            { type: Number },
  current:             { type: Number },
  absoluteDifference:  { type: Number },
  relativeDeviation:   { type: Number },
}, { _id: false });

const shiftRecordSchema = new mongoose.Schema(
  {
    // Which detection triggered this analysis
    imageName:          { type: String, required: true },
    inferenceRecordId:  { type: mongoose.Schema.Types.ObjectId, ref: 'InferenceRecord' },

    // Image statistics computed by Python
    imageStats:   { type: imageStatsSchema, default: {} },

    // Baseline statistics (from Python reference-dataset)
    baselineStats: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Shift result
    shiftScore:   { type: Number, required: true, default: 0 },
    shiftStatus:  {
      type: String,
      enum: ['NORMAL', 'MODERATE', 'HIGH', 'UNKNOWN'],
      default: 'UNKNOWN',
    },
    shiftDetected: { type: Boolean, default: false },

    // Per-metric breakdown
    metrics: {
      type: mongoose.Schema.Types.Mixed,   // key → metricDetailSchema
      default: {},
    },

    // Source metadata
    baselineSource:   { type: String, default: 'reference-dataset' },
    baselineSamples:  { type: Number, default: 0 },

    analysedAt: { type: String },
  },
  {
    timestamps: true,
    collection: 'shiftrecords',
  }
);

shiftRecordSchema.index({ createdAt: -1 });
shiftRecordSchema.index({ shiftStatus: 1 });

module.exports = mongoose.model('ShiftRecord', shiftRecordSchema);
