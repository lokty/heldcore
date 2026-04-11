defmodule Mix.Tasks.StaticExport do
  @moduledoc """
  Rebuild the static GitHub Pages bundle from the current source.

  Steps:
    1. `mix esbuild heldcore --minify` (rebuild `priv/static/assets/js/static_app.js`)
    2. `mix tailwind heldcore --minify` (rebuild `priv/static/assets/css/app.css`)
    3. Fetch `/` and `/impressum` from a running dev server, rewrite asset paths
       to the static layout, strip the LiveReload iframe, and write the result
       into `index.html` / `impressum.html` at the repo root.

  The running dev server is required because the LiveView templates contain
  `<%= %>` and other server-rendered bits that we can't easily evaluate from a
  Mix task without booting the full LiveView stack ourselves. Start it first:

      mix phx.server
      mix static_export
  """

  use Mix.Task

  @shortdoc "Build minified assets and re-render the static GitHub Pages HTML"

  @endpoint "http://localhost:4000"

  @pages [
    {"/", "index.html"},
    {"/impressum", "impressum.html"}
  ]

  # Path rewrites applied to the minified JS bundle so asset lookups done from
  # JavaScript (not from HTML) work on the GitHub Pages layout. The source keeps
  # the Phoenix dev paths so `mix phx.server` still works unchanged.
  @bundle_rewrites %{
    "/images/noise.jpg" => "priv/static/images/noise.jpg"
  }

  @bundle_path "priv/static/assets/js/static_app.js"

  @impl Mix.Task
  def run(_args) do
    Mix.Task.run("esbuild", ["heldcore", "--minify"])
    Mix.Task.run("tailwind", ["heldcore", "--minify"])
    rewrite_bundle_paths()

    {:ok, _} = Application.ensure_all_started(:req)

    case Req.get(@endpoint <> "/", retry: false, connect_options: [timeout: 1000]) do
      {:ok, %Req.Response{status: 200}} ->
        :ok

      _ ->
        Mix.raise("""
        Phoenix dev server not reachable on #{@endpoint}.
        Start it in another terminal first:

            mix phx.server
        """)
    end

    Enum.each(@pages, fn {route, out_path} ->
      fetch_and_write(route, out_path)
    end)

    Mix.shell().info("Static export complete: #{Enum.map_join(@pages, ", ", &elem(&1, 1))}")
  end

  defp fetch_and_write(route, out_path) do
    %Req.Response{status: 200, body: body} = Req.get!(@endpoint <> route)

    rewritten =
      body
      |> String.replace(~s(/assets/css/app.css), ~s(priv/static/assets/css/app.css))
      |> String.replace(~s(/assets/js/app.js), ~s(priv/static/assets/js/static_app.js))
      |> String.replace(~s("/images/), ~s("priv/static/images/))
      |> String.replace(~s(href="/impressum"), ~s(href="impressum.html"))
      |> strip_live_reload()

    File.write!(out_path, rewritten)
    Mix.shell().info("  wrote #{out_path}")
  end

  defp strip_live_reload(html) do
    Regex.replace(
      ~r|\s*<iframe[^>]*phoenix/live_reload/frame[^>]*></iframe>|,
      html,
      ""
    )
  end

  defp rewrite_bundle_paths do
    content = File.read!(@bundle_path)

    rewritten =
      Enum.reduce(@bundle_rewrites, content, fn {from, to}, acc ->
        String.replace(acc, from, to)
      end)

    if rewritten != content do
      File.write!(@bundle_path, rewritten)
      Mix.shell().info("  rewrote asset paths inside #{@bundle_path}")
    end
  end
end
