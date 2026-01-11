import { Result } from "../models/result.models.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { resultServices } from "../services/result.service.js";

// Create a new result

const createResult = asyncHandler(async (req, res, next) => {
  const { event, winningRegistrations } = req.body;

  if (!event || !winningRegistrations) {
    return next(new ApiError(400, "Please provide all required fields"));
  }

  const newResult = await resultServices.createResult(
    event,
    winningRegistrations,
    req.user._id
  );

  if (!newResult) {
    return next(new ApiError(500, "Failed to create result"));
  }

  res
    .status(201)
    .json(new ApiResponse(201, newResult, "Result created successfully"));
});

// Get all results

const fetchAllResults = asyncHandler(async (req, res, next) => {
  const results = await resultServices.fetchAllResults();

  if (!results) {
    return next(new ApiError(404, "No results found"));
  }

  res.status(200).json(new ApiResponse(200, results, "Results found"));
});

const fetchResultById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const result = await Result.findById(id);

  if (!result) {
    return next(new ApiError(404, "Result not found"));
  }

  res.status(200).json(new ApiResponse(200, result, "Result found"));
});

const fetchResultByEventId = asyncHandler(async (req, res, next) => {
  const { event_id } = req.params;

  const result = await resultServices.fetchResultByEventId(event_id);

  if (!result) {
    return next(new ApiError(404, "Result not found"));
  }

  res.status(200).json(new ApiResponse(200, result, "Result found"));
});

const updateResult = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const { event, winningRegistrations } = req.body;

  if (!event || !winningRegistrations) {
    return next(new ApiError(400, "Please provide all required fields"));
  }

  const updatedResult = await resultServices.updateResult(
    id,
    winningRegistrations,
    req.user._id
  );

  if (!updatedResult) {
    return next(new ApiError(500, "Failed to update result"));
  }

  res
    .status(200)
    .json(new ApiResponse(200, updatedResult, "Result updated successfully"));
});

const deleteResult = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const resultStatus = await resultServices.deleteResult(id);

  if (!resultStatus) {
    return next(new ApiError(404, "Result not found"));
  }

  res
    .status(200)
    .json(new ApiResponse(200, null, "Result deleted successfully"));
});

const fetchAllIndividualResults = asyncHandler(async (req, res, next) => {
  const results = await resultServices.fetchAllIndividualResults();

  if (!results) {
    return next(new ApiError(404, "No results found"));
  }

  res.status(200).json(new ApiResponse(200, results, "Results found"));
});

const fetchLeaderboard = asyncHandler(async (req, res, next) => {
  const results = await resultServices.fetchLeaderboardData();

  if (!results) {
    return next(new ApiError(404, "No results found"));
  }

  res.status(200).json(new ApiResponse(200, results, "Results found"));
});

const fetchResultsGroupedByCollege = asyncHandler(async (req, res, next) => {

  const results = await resultServices.fetchResultsGroupedByCollege();

  if (results.length === 0) {
    return new ApiResponse (200 , results , "No results found");
  }

  res.status(200).json(new ApiResponse(200, results, "Results found"));

});

const fetchDetailedGenderTopperResults = asyncHandler(async (req, res, next) => {
  const results = await resultServices.fetchDetailedGenderTopperResults();

  if (!results) {
    return next(new ApiError(404, "No results found"));
  }

  res.status(200).json(new ApiResponse(200, results, "Results found"));
});

export const resultController = {
  createResult,
  fetchAllResults,
  fetchResultById,
  fetchResultByEventId,
  updateResult,
  deleteResult,
  fetchAllIndividualResults,
  fetchLeaderboard,
  fetchResultsGroupedByCollege,
  fetchDetailedGenderTopperResults
};
