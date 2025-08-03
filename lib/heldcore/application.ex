defmodule Heldcore.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      HeldcoreWeb.Telemetry,
      Heldcore.Repo,
      {DNSCluster, query: Application.get_env(:heldcore, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: Heldcore.PubSub},
      # Start a worker by calling: Heldcore.Worker.start_link(arg)
      # {Heldcore.Worker, arg},
      # Start to serve requests, typically the last entry
      HeldcoreWeb.Endpoint
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Heldcore.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    HeldcoreWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
