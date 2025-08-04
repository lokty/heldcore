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
    show_mask: true,
    canvas_width: 400,
    canvas_height: 300,
    simplify_tolerance: 1,
    smoothness: 0.5,
    weirdness: 0
  }

  @impl true
  def mount(_params, _session, socket) do
    socket =
      socket
      |> assign(@defaults)
      |> push_event("update_coral", js_params(@defaults))

    {:ok, socket}
  end

  @impl true
  def handle_event("update", params, socket) do
    # Filter out Phoenix form params and only keep our coral parameters
        coral_params =
      params
      |> Enum.filter(fn {k, _v} -> not String.starts_with?(k, "_") end)
      |> Enum.into(%{}, fn {k, v} -> {String.to_existing_atom(k), parse(v)} end)
      |> ensure_boolean(:show_mask, params)

    socket =
      socket
      |> assign(coral_params)
      |> push_event("update_coral", js_params(Map.merge(socket.assigns, coral_params)))

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
      weirdness: a.weirdness
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
        <%= render_slider "Attractors", :attractor_count, 50, 500, assigns %>
        <%= render_slider "Max angle", :max_abs_angle, 0, 90, assigns %>
        <%= render_slider "Segment length", :segment_length, 3, 30, assigns %>
        <%= render_slider "Node radius", :node_radius, 2, 10, assigns %>
        <%= render_slider "Tapering", :tapering, 0.5, 0.99, assigns, step: 0.01 %>
        <%= render_slider "Segment scale", :segment_scale, 0.3, 1, assigns, step: 0.05 %>
        <%= render_slider "Mask size", :mask_size, 0.1, 0.6, assigns, step: 0.05 %>
        <%= render_slider "Mask strength", :mask_strength, 0.05, 0.3, assigns, step: 0.02 %>
        <%= render_slider "Simplify tolerance", :simplify_tolerance, 0, 20, assigns %>
        <%= render_slider "Smoothness", :smoothness, 0, 2, assigns, step: 0.1 %>
        <%= render_slider "Weirdness", :weirdness, 0, 1, assigns, step: 0.05 %>
        <label class="flex items-center space-x-2 text-xs col-span-2">
          <input type="checkbox" name="show_mask" checked={@show_mask} />
          <span>Show Mask</span>
        </label>
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
