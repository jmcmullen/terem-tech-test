import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useUrlContext } from "~/contexts/UrlContext";
import { CleanuriOkResponse } from "~/schemas/cleanuriSchemas";
import { handleForm } from "~/serverActions/cleanuriActions";
import { Shorten } from "../Shorten";

jest.mock("~/contexts/UrlContext", () => ({
  useUrlContext: jest.fn(),
}));

jest.mock("~/serverActions/cleanuriActions", () => ({
  handleForm: jest.fn(),
}));

describe("<Shorten />", () => {
  const mockAddUrl = jest.fn();
  const mockCheckUrl = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useUrlContext as jest.Mock).mockReturnValue({
      addUrl: mockAddUrl,
      checkUrl: mockCheckUrl.mockReturnValue({ exists: false }),
    });

    jest.mocked(handleForm).mockResolvedValue({
      resultUrl: "https://cleanuri.com/abc123",
      originalUrl: "https://example.com",
    });
  });

  test("renders the form correctly", () => {
    render(<Shorten />);

    expect(screen.getByPlaceholderText("Shorten a link here...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /shorten it!/i })).toBeInTheDocument();
  });

  test("submits form with valid URL", async () => {
    const user = userEvent.setup();
    render(<Shorten />);

    const input = screen.getByPlaceholderText("Shorten a link here...");
    const submitButton = screen.getByRole("button", { name: /shorten it!/i });

    await user.type(input, "https://example.com");
    await user.click(submitButton);

    await waitFor(() => {
      expect(handleForm).toHaveBeenCalledWith({
        data: { url: "https://example.com" },
      });
      expect(mockAddUrl).toHaveBeenCalledWith({
        resultUrl: "https://cleanuri.com/abc123",
        originalUrl: "https://example.com",
      });
    });
  });

  test("shows error message when URL already exists", async () => {
    mockCheckUrl.mockReturnValue({
      exists: true,
      duplicateUrl: {
        resultUrl: "https://cleanuri.com/abc123",
        originalUrl: "https://example.com",
      },
    });

    const user = userEvent.setup();
    render(<Shorten />);

    const input = screen.getByPlaceholderText("Shorten a link here...");
    await user.type(input, "https://example.com");

    await waitFor(() => {
      expect(
        screen.getByText("You have already shortened this link"),
      ).toBeInTheDocument();
    });
  });

  test("shows API error message when request fails", async () => {
    jest.mocked(handleForm).mockResolvedValue({
      error: "Invalid URL",
    });

    const user = userEvent.setup();
    render(<Shorten />);

    const input = screen.getByPlaceholderText("Shorten a link here...");
    const submitButton = screen.getByRole("button", { name: /shorten it!/i });

    await user.type(input, "https://example.com");
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Invalid URL")).toBeInTheDocument();
    });
  });

  test("clears form after successful submission", async () => {
    const user = userEvent.setup();
    render(<Shorten />);

    const input = screen.getByPlaceholderText("Shorten a link here...");
    const submitButton = screen.getByRole("button", { name: /shorten it!/i });

    await user.type(input, "https://example.com");
    await user.click(submitButton);

    await waitFor(() => {
      expect(input).toHaveValue("");
    });
  });

  test("shows loading state during submission", async () => {
    let resolvePromise!: (value: CleanuriOkResponse) => void;
    jest.mocked(handleForm).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve;
        }),
    );

    const user = userEvent.setup();
    render(<Shorten />);

    const input = screen.getByPlaceholderText("Shorten a link here...");
    await user.type(input, "https://example.com");

    const submitButton = screen.getByRole("button", { name: /shorten it!/i });
    await user.click(submitButton);

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    resolvePromise({
      resultUrl: "https://cleanuri.com/abc123",
      originalUrl: "https://example.com",
    });

    await waitFor(() => {
      expect(screen.getByText("Shorten It!")).toBeInTheDocument();
    });
  });

  test("clears error message when input changes", async () => {
    jest.mocked(handleForm).mockResolvedValueOnce({
      error: "Invalid URL",
    });

    const user = userEvent.setup();
    render(<Shorten />);

    const input = screen.getByPlaceholderText("Shorten a link here...");
    const submitButton = screen.getByRole("button", { name: /shorten it!/i });

    await user.type(input, "invalid-url");
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Invalid URL")).toBeInTheDocument();
    });

    await user.clear(input);
    await user.type(input, "https://example.com");

    expect(screen.queryByText("Invalid URL")).not.toBeInTheDocument();
  });
});
