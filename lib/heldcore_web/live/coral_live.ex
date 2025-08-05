defmodule HeldcoreWeb.CoralLive do
  use HeldcoreWeb, :live_view

  @defaults %{
    attractor_count: 423,
    max_abs_angle: 87,
    segment_length: 13,
    node_radius: 9,
    tapering: 0.96,
    segment_scale: 0.85,
    mask_size: 0.3,
    mask_strength: 0.11,
    show_mask: false,
    canvas_width: 400,
    canvas_height: 300,
    simplify_tolerance: 0.0,
    smoothness: 0.5,
    weirdness: 0,
    branch_shyness: 0.8,
    drawing_mode: false,
    custom_mask_points: [],
    fill_mode: true,
    gradient_colors: ["#ff385d","#ff8093"],
    source_x: 0.3,
    source_y: 0.8,
    show_skeleton: false
  }

  @impl true
  def mount(_params, _session, socket) do
    params = js_params(@defaults)
    IO.inspect(params, label: "JS params sent on mount")

    socket =
      socket
      |> assign(@defaults)
      |> push_event("update_coral", params)

    {:ok, socket}
  end

  @impl true
  def handle_event("update", params, socket) do
    # Decode gradient_colors JSON before parsing other fields
    gradient_colors =
      case Map.get(params, "gradient_colors") do
        nil -> socket.assigns.gradient_colors
        v -> Jason.decode!(v)
      end

    # Filter out Phoenix form params, custom gradient_colors, and parse the rest
    coral_params =
      params
      |> Enum.filter(fn {k, _v} -> not String.starts_with?(k, "_") and k != "gradient_colors" end)
      |> Enum.into(%{}, fn {k, v} -> {String.to_existing_atom(k), parse(v)} end)
      |> ensure_boolean(:show_mask, params)
      |> ensure_boolean(:fill_mode, params)
      |> ensure_boolean(:show_skeleton, params)
      |> Map.put(:gradient_colors, gradient_colors)

    socket =
      socket
      |> assign(coral_params)
      |> push_event("update_coral", js_params(Map.merge(socket.assigns, coral_params)))

    {:noreply, socket}
  end

  @impl true
  def handle_event("toggle_drawing", _params, socket) do
    new_drawing_mode = !socket.assigns.drawing_mode
    socket =
      socket
      |> assign(:drawing_mode, new_drawing_mode)
      |> push_event("update_coral", js_params(Map.merge(socket.assigns, %{drawing_mode: new_drawing_mode})))

    {:noreply, socket}
  end

  @impl true
  def handle_event("add_mask_point", %{"x" => x, "y" => y}, socket) do
    if socket.assigns.drawing_mode do
      new_point = [x, y]
      points = socket.assigns.custom_mask_points ++ [new_point]

      socket =
        socket
        |> assign(:custom_mask_points, points)
        |> push_event("update_coral", js_params(Map.merge(socket.assigns, %{custom_mask_points: points})))

      {:noreply, socket}
    else
      {:noreply, socket}
    end
  end

  @impl true
  def handle_event("clear_mask", _params, socket) do
    socket =
      socket
      |> assign(:custom_mask_points, [])
      |> push_event("update_coral", js_params(Map.merge(socket.assigns, %{custom_mask_points: []})))

    {:noreply, socket}
  end

  @impl true
  def handle_event("set_custom_mask", %{"points" => points}, socket) do
    socket =
      socket
      |> assign(:custom_mask_points, points)
      |> assign(:drawing_mode, false)
      |> push_event("update_coral", js_params(Map.merge(socket.assigns, %{custom_mask_points: points, drawing_mode: false})))

    {:noreply, socket}
  end

  defp ensure_boolean(map, key, params) do
    cond do
      Map.has_key?(map, key) -> map
      Map.has_key?(params, Atom.to_string(key)) -> Map.put(map, key, true)
      true -> Map.put(map, key, false)
    end
  end

  defp parse(v) do
    cond do
      v in ["on", "true"] -> true
      v == "false" -> false
      true ->
        case Float.parse(v) do
          {f, _} -> f
          :error -> String.to_integer(v)
        end
    end
  end

  defp js_params(a) do
    %{
      attractorCount: round(a.attractor_count),
      maxAbsAngle: :math.pi() * a.max_abs_angle / 180,
      segmentLength: a.segment_length,
      nodeRadius: a.node_radius,
      tapering: a.tapering,
      segmentScale: a.segment_scale,
      size: a.mask_size,
      strength: a.mask_strength,
      showMask: a.show_mask,
      canvasWidth: round(a.canvas_width),
      canvasHeight: round(a.canvas_height),
      simplifyTolerance: a.simplify_tolerance,
      smoothness: a.smoothness,
      weirdness: a.weirdness,
      branchShyness: a.branch_shyness,
      fillMode: a.fill_mode,
      sourceX: a.source_x,
      sourceY: a.source_y,
      gradientColors: a.gradient_colors,
      showSkeleton: a.show_skeleton,
      drawingMode: a.drawing_mode,
      customMaskPoints: a.custom_mask_points
    }
  end

  defp slider(assigns) do
    ~H"""
    <label class="flex flex-col text-xs">
      <span><%= @label %>: <%= @val %></span>
      <input type="range" name={@field} min={@min} max={@max} step={@step} value={@val} />
    </label>
    """
  end

  @impl true
  def render(assigns) do
    ~H"""
    <div class="p-4 space-y-4">
      <div id="coral" phx-hook="GrowCoral" phx-update="ignore"
           style={"width: #{@canvas_width}px; height: #{@canvas_height}px"}
           class="border border-gray-300"></div>
      <form phx-change="update" class="grid grid-cols-4 gap-4">
        <%= render_slider "Canvas width", :canvas_width, 200, 800, assigns %>
        <%= render_slider "Canvas height", :canvas_height, 150, 600, assigns %>
        <%= render_slider "Source X", :source_x, 0, 1, assigns, step: 0.05 %>
        <%= render_slider "Source Y", :source_y, 0, 1, assigns, step: 0.05 %>
        <%= render_slider "Attractors", :attractor_count, 50, 500, assigns %>
        <%= render_slider "Max angle", :max_abs_angle, 0, 90, assigns %>
        <%= render_slider "Segment length", :segment_length, 3, 30, assigns %>
        <%= render_slider "Node radius", :node_radius, 2, 10, assigns %>
        <%= render_slider "Tapering", :tapering, 0.5, 0.99, assigns, step: 0.01 %>
        <%= render_slider "Segment scale", :segment_scale, 0.3, 1, assigns, step: 0.05 %>
        <%= render_slider "Mask size", :mask_size, 0.1, 0.6, assigns, step: 0.05 %>
        <%= render_slider "Mask strength", :mask_strength, 0.05, 0.3, assigns, step: 0.02 %>
        <label class="flex items-center space-x-2 text-xs">
          <input type="checkbox" name="fill_mode" checked={@fill_mode} />
          <span>Fill mode</span>
        </label>
        <label class="flex flex-col text-xs col-span-4">
          <span>Gradient Colors (JSON array):</span>
          <input type="text" name="gradient_colors" value={Jason.encode!(@gradient_colors)} class="mt-1 p-1 border text-xs" />
        </label>
        <%= render_slider "Simplify tolerance", :simplify_tolerance, 0, 20, assigns %>
        <%= render_slider "Smoothness", :smoothness, 0, 2, assigns, step: 0.1 %>
        <%= render_slider "Weirdness", :weirdness, 0, 1, assigns, step: 0.05 %>
        <%= render_slider "Branch shyness", :branch_shyness, 0, 3, assigns, step: 0.1 %>
        <label class="flex items-center space-x-2 text-xs">
          <input type="checkbox" name="show_mask" checked={@show_mask} />
          <span>Show Mask</span>
        </label>
        <label class="flex items-center space-x-2 text-xs">
          <input type="checkbox" name="show_skeleton" checked={@show_skeleton} />
          <span>Show Skeleton</span>
        </label>
        <div class="flex gap-2 text-xs">
          <button type="button" phx-click="toggle_drawing" class={"px-2 py-1 rounded text-white #{if @drawing_mode, do: "bg-red-500", else: "bg-blue-500"}"}>
            <%= if @drawing_mode, do: "Stop Drawing", else: "Draw Mask" %>
          </button>
          <button type="button" phx-click="clear_mask" class="px-2 py-1 rounded bg-gray-500 text-white">Clear</button>
        </div>
      </form>

      <h3 class="text-xs font-semibold">Current Config (copy & use as defaults):</h3>
      <pre class="text-[10px] bg-gray-100 p-2 rounded overflow-x-auto"><%= Jason.encode!(js_params(assigns), pretty: true) %></pre>
    </div>
    """
  end

  defp render_slider(label, field, min, max, assigns, opts \\ []) do
    step = Keyword.get(opts, :step, 1)
    val = Map.get(assigns, field)
    assigns = %{label: label, field: to_string(field), min: min, max: max, step: step, val: val}
    slider(assigns)
  end
end
